import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface SecurityContextType {
  isLoggedIn: boolean;
  sessionChecked: boolean;           // ← NEW: true once session hydration is done
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const SecurityContext = createContext<SecurityContextType | null>(null);

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn,     setIsLoggedIn]     = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false); // wait for hydration

  useEffect(() => {
    // 1. Restore existing session on page load/refresh
    supabase.auth.getSession().then(({ data: { session } }) => {
      const role = session?.user?.user_metadata?.role;
      setIsLoggedIn(role === 'security');
      setSessionChecked(true);          // ← mark done regardless of result
    });

    // 2. Stay in sync with auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const role = session?.user?.user_metadata?.role;
      setIsLoggedIn(role === 'security');
      setSessionChecked(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        return { ok: false, error: 'Invalid email/password, or email not confirmed. Run the SQL fix in Supabase.' };
      }
      return { ok: false, error: error.message };
    }

    const role = data.user?.user_metadata?.role;
    if (role !== 'security') {
      await supabase.auth.signOut();
      return { ok: false, error: 'This account does not have security access.' };
    }

    setIsLoggedIn(true);
    return { ok: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
  };

  return (
    <SecurityContext.Provider value={{ isLoggedIn, sessionChecked, login, logout }}>
      {children}
    </SecurityContext.Provider>
  );
}

export const useSecurityAuth = () => {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error('useSecurityAuth must be used within SecurityProvider');
  return ctx;
};
