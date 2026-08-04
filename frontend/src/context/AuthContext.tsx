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
  login: (phone: string, name?: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check local storage for existing session on load
    const storedWorker = localStorage.getItem('worker_session');
    if (storedWorker) {
      setWorker(JSON.parse(storedWorker));
    }
    setIsLoading(false);
  }, []);

  const login = async (phone: string, name?: string) => {
    setIsLoading(true);
    try {
      // 1. Check if worker already exists by phone
      const { data: existingWorker } = await supabase
        .from('workers')
        .select('*')
        .eq('phone', phone)
        .single();

      if (existingWorker) {
        // Returning worker — log them in (ignore the name they typed, their profile is already set)
        setWorker(existingWorker);
        localStorage.setItem('worker_session', JSON.stringify(existingWorker));
        return true;
      }

      // 2. New worker — register using the provided name
      if (name) {
        const { data: newWorker, error: insertError } = await supabase
          .from('workers')
          .insert([{ phone, name }])
          .select()
          .single();

        if (newWorker) {
          setWorker(newWorker);
          localStorage.setItem('worker_session', JSON.stringify(newWorker));
          return true;
        }

        console.error('Insert error:', insertError);
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
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
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
