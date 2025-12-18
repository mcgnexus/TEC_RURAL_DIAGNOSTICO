'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseBrowser';

const UserContext = createContext({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(
    async currentUser => {
      if (!currentUser) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, credits_remaining, first_name, last_name, phone')
        .eq('id', currentUser.id)
        .single();

      if (!error) {
        setProfile(data);
      } else {
        console.error('Error loading profile:', error);
      }
    },
    []
  );

  useEffect(() => {
    const loadSession = async () => {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const currentUser = session?.user || null;
      setUser(currentUser);
      await fetchProfile(currentUser);
      setLoading(false);
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      fetchProfile(currentUser);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user);
    }
  }, [fetchProfile, user]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      refreshProfile,
    }),
    [user, profile, loading, refreshProfile]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export const useUserContext = () => useContext(UserContext);
