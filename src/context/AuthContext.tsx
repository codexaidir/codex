import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface AuthContextType {
  session: any | null;
  user: any | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<any | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSupabaseConfigured) {
      // --- REAL SUPABASE MODE ---
      const getInitialSession = async () => {
        try {
          const { data: { session: initialSession } } = await supabase.auth.getSession();
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
        } catch (error) {
          console.error('Error fetching initial session:', error);
        } finally {
          setLoading(false);
        }
      };

      getInitialSession();

      // Listen to auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      // --- DEMO / SANDBOX PLAYGROUND MODE ---
      // Uses localStorage to prevent any "Failed to Fetch" error from unconfigured Supabase URLs
      try {
        const stored = localStorage.getItem('ai_studio_user_session');
        if (stored) {
          const parsed = JSON.parse(stored);
          setSession(parsed);
          setUser(parsed.user);
        }
      } catch (err) {
        console.error('Failed to parse local sandbox session:', err);
      } finally {
        setLoading(false);
      }
    }
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    if (isSupabaseConfigured) {
      // Real Supabase sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } else {
      // Sandbox Mode sign in - any email and password signs in successfully!
      // This allows direct app playground access in AI Studio
      return new Promise<{ error: any }>((resolve) => {
        setTimeout(() => {
          const mockUser = {
            id: 'mock-user-12345',
            email: email,
            role: 'authenticated',
          };
          const mockSession = {
            access_token: 'mock-jwt-token',
            user: mockUser,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          };
          
          setSession(mockSession);
          setUser(mockUser);
          localStorage.setItem('ai_studio_user_session', JSON.stringify(mockSession));
          resolve({ error: null });
        }, 800);
      });
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.error('Error signing out from Supabase:', error);
      }
    } else {
      localStorage.removeItem('ai_studio_user_session');
      setSession(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signInWithPassword, signOut }}>
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
