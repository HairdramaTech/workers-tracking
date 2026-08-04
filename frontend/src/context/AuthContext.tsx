import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface Worker {
  id: string;
  name: string;
  phone: string;
}

interface AuthContextType {
  worker: Worker | null;
  login: (phone: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('worker_session');
    if (stored) setWorker(JSON.parse(stored));
    setIsLoading(false);
  }, []);

  const login = async (phone: string): Promise<{ ok: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('id, name, phone')
        .eq('phone', phone)
        .single();

      if (error || !data) {
        return { ok: false, error: 'Phone number not registered. Please ask your manager to add you.' };
      }

      setWorker(data);
      localStorage.setItem('worker_session', JSON.stringify(data));
      return { ok: true };
    } catch {
      return { ok: false, error: 'Something went wrong. Please try again.' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setWorker(null);
    localStorage.removeItem('worker_session');
  };

  return (
    <AuthContext.Provider value={{ worker, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
