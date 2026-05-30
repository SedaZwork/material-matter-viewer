import { useState, useEffect } from 'react';
import { User, Session } from '@supabaseService.getAuth()/supabaseService.getAuth()-js';
import { supabaseService.getAuth()Service } from '@/services/SupabaseService';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabaseService.getAuth().auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabaseService.getAuth().auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabaseService.getAuth().auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabaseService.getAuth().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: displayName ? { display_name: displayName } : {}
      }
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabaseService.getAuth().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` }
    });
    return { error };
  };

  const signInWithApple = async () => {
    const { error } = await supabaseService.getAuth().auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: `${window.location.origin}/` }
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabaseService.getAuth().auth.signOut();
    return { error };
  };

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithApple,
    signOut
  };
};
