import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string, displayName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    const initAuth = async () => {
      const savedUser = localStorage.getItem("tivoo_user");
      if (savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          // Verify user still exists in database
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userData.id)
            .single();
          
          if (data && !error) {
            setUser(data);
            // Update last_seen
            await supabase
              .from("profiles")
              .update({ last_seen: new Date().toISOString() })
              .eq("id", data.id);
          } else {
            // Clear invalid session
            localStorage.removeItem("tivoo_user");
            setUser(null);
          }
        } catch (error) {
          console.error("Session restore error:", error);
          localStorage.removeItem("tivoo_user");
          setUser(null);
        }
      }
      setLoading(false);
    };
    
    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      // Call edge function for login
      const { data, error } = await supabase.functions.invoke("login", {
        body: { username, password },
      });

      if (error) throw error;

      if (data.success && data.user) {
        setUser(data.user);
        localStorage.setItem("tivoo_user", JSON.stringify(data.user));
        return { success: true };
      } else {
        return { success: false, error: data.error || "فشل تسجيل الدخول" };
      }
    } catch (error: any) {
      console.error("Login error:", error);
      return { success: false, error: error.message || "حدث خطأ أثناء تسجيل الدخول" };
    }
  };

  const register = async (username: string, password: string, displayName?: string) => {
    try {
      // Call edge function for registration
      const { data, error } = await supabase.functions.invoke("register", {
        body: { username, password, displayName },
      });

      if (error) throw error;

      if (data.success && data.user) {
        setUser(data.user);
        localStorage.setItem("tivoo_user", JSON.stringify(data.user));
        return { success: true };
      } else {
        return { success: false, error: data.error || "فشل إنشاء الحساب" };
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      return { success: false, error: error.message || "حدث خطأ أثناء إنشاء الحساب" };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("tivoo_user");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
