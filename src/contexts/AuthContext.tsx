import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string, displayName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateOnlineStatus: (isOnline: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const onlineIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateOnlineStatus = async (isOnline: boolean) => {
    if (!user) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ 
          is_online: isOnline,
          last_seen: new Date().toISOString()
        })
        .eq('id', user.id);
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      void (async () => {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', parsedUser.id)
            .single();
          
          if (data && !data.is_banned) {
            setUser(data);
            void supabase
              .from('profiles')
              .update({ 
                is_online: true,
                last_seen: new Date().toISOString()
              })
              .eq('id', data.id);
          } else {
            localStorage.removeItem('user');
          }
        } catch {
          localStorage.removeItem('user');
        }
        setLoading(false);
      })();
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      updateOnlineStatus(true);
      
      onlineIntervalRef.current = setInterval(() => {
        updateOnlineStatus(true);
      }, 30000);

      const handleBeforeUnload = () => {
        if (user) {
          const url = `https://ttvoviscvpcchptsnddn.supabase.co/rest/v1/profiles?id=eq.${user.id}`;
          const data = JSON.stringify({ is_online: false, last_seen: new Date().toISOString() });
          const blob = new Blob([data], { type: 'application/json' });
          navigator.sendBeacon(url, blob);
        }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('pagehide', handleBeforeUnload);

      return () => {
        if (onlineIntervalRef.current) {
          clearInterval(onlineIntervalRef.current);
        }
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('pagehide', handleBeforeUnload);
        updateOnlineStatus(false);
      };
    }
  }, [user]);

  const login = async (username: string, password: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('login', {
        body: { username, password },
      });

      if (error) throw error;

      if (data.success && data.user) {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        return { success: true };
      }

      return { success: false, error: data.error || 'فشل تسجيل الدخول' };
    } catch (error: any) {
      return { success: false, error: error.message || 'حدث خطأ أثناء تسجيل الدخول' };
    }
  };

  const register = async (username: string, password: string, displayName?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('register', {
        body: { username, password, displayName },
      });

      if (error) throw error;

      if (data.success && data.user) {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        return { success: true };
      }

      return { success: false, error: data.error || 'فشل إنشاء الحساب' };
    } catch (error: any) {
      return { success: false, error: error.message || 'حدث خطأ أثناء إنشاء الحساب' };
    }
  };

  const logout = () => {
    if (user) {
      void supabase
        .from('profiles')
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq('id', user.id);
    }
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateOnlineStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
