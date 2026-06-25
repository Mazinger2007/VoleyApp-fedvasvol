import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { supabase } from '../utils/supabase';

const KEYS = {
  user: '@auth_user',
  isGuest: '@auth_is_guest',
  deviceId: '@auth_device_id',
};

const AuthContext = createContext({
  user: null,
  userProfile: null,
  isGuest: true,
  isBlocked: false,
  blockedReason: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  continueAsGuest: () => {},
});

async function getDeviceId() {
  try {
    let id = await AsyncStorage.getItem(KEYS.deviceId);
    if (id) return id;
    if (Platform.OS === 'android') {
      id = await Application.getAndroidId();
    } else {
      id = await Application.getIosIdForVendorAsync();
    }
    if (!id) id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(KEYS.deviceId, id);
    return id;
  } catch {
    const fallback = `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(KEYS.deviceId, fallback);
    return fallback;
  }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isGuest, setIsGuest] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const guestFlag = await AsyncStorage.getItem(KEYS.isGuest);
      if (guestFlag === 'true') {
        setIsGuest(true);
        setLoading(false);
        return;
      }

      const userJson = await AsyncStorage.getItem(KEYS.user);
      if (!userJson) {
        setIsGuest(true);
        setLoading(false);
        return;
      }

      const savedUser = JSON.parse(userJson);
      if (!savedUser?.id) {
        setIsGuest(true);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', savedUser.id)
        .maybeSingle();

      if (error || !data) {
        await clearAuth();
        setLoading(false);
        return;
      }

      if (data.is_blocked) {
        setIsBlocked(true);
        setBlockedReason(data.blocked_reason || 'Tu cuenta ha sido deshabilitada');
        setLoading(false);
        return;
      }

      setUserProfile(data);
      setUser({ id: data.id, email: data.email });
      setIsGuest(false);
    } catch (e) {
      console.warn('[Auth] Restore failed:', e);
      await clearAuth();
    } finally {
      setLoading(false);
    }
  }

  async function clearAuth() {
    await AsyncStorage.multiRemove([KEYS.user, KEYS.isGuest]);
    setUser(null);
    setUserProfile(null);
    setIsGuest(true);
    setIsBlocked(false);
    setBlockedReason(null);
  }

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (error) throw new Error('Error al conectar con el servidor');
    if (!data) throw new Error('Usuario no encontrado');
    if (data.is_blocked) throw new Error(data.blocked_reason || 'Tu cuenta ha sido deshabilitada');

    await AsyncStorage.multiSet([
      [KEYS.user, JSON.stringify({ id: data.id, email: data.email })],
      [KEYS.isGuest, 'false'],
    ]);

    setUser({ id: data.id, email: data.email });
    setUserProfile(data);
    setIsGuest(false);
    setIsBlocked(false);
    setBlockedReason(null);
    return data;
  }, []);

  const signUp = useCallback(async (email, password, username) => {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existing) throw new Error('Ya existe una cuenta con este email');

    const { data: existingUsername } = await supabase
      .from('users')
      .select('id')
      .eq('username', username.trim())
      .maybeSingle();

    if (existingUsername) throw new Error('Este nombre de usuario ya está en uso');

    const newId = generateUUID();
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: newId,
        username: username.trim(),
        email: email.toLowerCase().trim(),
        role: 'user',
      })
      .select()
      .single();

    if (error) throw new Error('No se pudo crear la cuenta: ' + (error.message || ''));

    await AsyncStorage.multiSet([
      [KEYS.user, JSON.stringify({ id: data.id, email: data.email })],
      [KEYS.isGuest, 'false'],
    ]);

    setUser({ id: data.id, email: data.email });
    setUserProfile(data);
    setIsGuest(false);
    setIsBlocked(false);
    setBlockedReason(null);
    return data;
  }, []);

  const signOut = useCallback(async () => {
    await clearAuth();
  }, []);

  const continueAsGuest = useCallback(async () => {
    setIsGuest(true);
    setIsBlocked(false);
    setBlockedReason(null);
    await AsyncStorage.setItem(KEYS.isGuest, 'true');
  }, []);

  const value = useMemo(() => ({
    user,
    userProfile,
    isGuest,
    isBlocked,
    blockedReason,
    loading,
    signIn,
    signUp,
    signOut,
    continueAsGuest,
  }), [user, userProfile, isGuest, isBlocked, blockedReason, loading, signIn, signUp, signOut, continueAsGuest]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
