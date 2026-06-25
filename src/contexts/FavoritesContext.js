import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { supabase } from '../utils/supabase';

const STORAGE_KEY = '@favorites';

const FavoritesContext = createContext({
  favorites: [],
  loading: true,
  isFavorite: () => false,
  addFavorite: async () => {},
  removeFavorite: async () => {},
  toggleFavorite: async () => {},
});

export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, [user]);

  async function loadFavorites() {
    try {
      const localKey = user ? `${STORAGE_KEY}_${user.id}` : STORAGE_KEY;
      const raw = await AsyncStorage.getItem(localKey);
      const localFavs = raw ? JSON.parse(raw) : [];

      if (user) {
        const { data: dbFavs, error } = await supabase
          .from('favorites')
          .select('entity_type, entity_id, created_at')
          .eq('user_id', user.id);

        if (!error && dbFavs) {
          const mapped = dbFavs.map(f => ({
            entityType: f.entity_type,
            entityId: f.entity_id,
            createdAt: new Date(f.created_at).getTime(),
          }));

          const localMap = new Map(localFavs.map(f => [`${f.entityType}:${f.entityId}`, f]));
          mapped.forEach(f => {
            if (!localMap.has(`${f.entityType}:${f.entityId}`)) {
              localMap.set(`${f.entityType}:${f.entityId}`, f);
            }
          });

          const merged = Array.from(localMap.values());
          setFavorites(merged);
          await AsyncStorage.setItem(localKey, JSON.stringify(merged));

          for (const fav of localFavs) {
            const exists = dbFavs.some(f => f.entity_type === fav.entityType && f.entity_id === fav.entityId);
            if (!exists) {
              await supabase.from('favorites').upsert({
                user_id: user.id,
                entity_type: fav.entityType,
                entity_id: fav.entityId,
              }, { onConflict: 'user_id,entity_type,entity_id' });
            }
          }
          return;
        }
      }

      setFavorites(localFavs);
    } catch (e) {
      console.warn('[Favorites] Load failed:', e);
    } finally {
      setLoading(false);
    }
  }

  async function persist(newFavorites) {
    setFavorites(newFavorites);
    const localKey = user ? `${STORAGE_KEY}_${user.id}` : STORAGE_KEY;
    await AsyncStorage.setItem(localKey, JSON.stringify(newFavorites));

    if (user) {
      try {
        const entityType = newFavorites[newFavorites.length - 1]?.entityType;
        const entityId = newFavorites[newFavorites.length - 1]?.entityId;

        const { data: dbFavs } = await supabase
          .from('favorites')
          .select('entity_type, entity_id')
          .eq('user_id', user.id);

        const dbSet = new Set((dbFavs || []).map(f => `${f.entity_type}:${f.entity_id}`));
        const localSet = new Set(newFavorites.map(f => `${f.entityType}:${f.entityId}`));

        for (const fav of newFavorites) {
          const key = `${fav.entityType}:${fav.entityId}`;
          if (!dbSet.has(key)) {
            await supabase.from('favorites').upsert({
              user_id: user.id,
              entity_type: fav.entityType,
              entity_id: fav.entityId,
            }, { onConflict: 'user_id,entity_type,entity_id' });
          }
        }

        for (const dbFav of (dbFavs || [])) {
          const key = `${dbFav.entity_type}:${dbFav.entity_id}`;
          if (!localSet.has(key)) {
            await supabase
              .from('favorites')
              .delete()
              .eq('user_id', user.id)
              .eq('entity_type', dbFav.entity_type)
              .eq('entity_id', dbFav.entity_id);
          }
        }
      } catch (e) {
        console.warn('[Favorites] DB sync failed:', e);
      }
    }
  }

  const isFavorite = useCallback((entityType, entityId) => {
    return favorites.some(f => f.entityType === entityType && f.entityId === entityId);
  }, [favorites]);

  const addFavorite = useCallback(async (entityType, entityId, entityName) => {
    if (isFavorite(entityType, entityId)) return;
    const newFav = { entityType, entityId, entityName, createdAt: Date.now() };
    await persist([...favorites, newFav]);
  }, [favorites, isFavorite]);

  const removeFavorite = useCallback(async (entityType, entityId) => {
    const filtered = favorites.filter(f => !(f.entityType === entityType && f.entityId === entityId));
    await persist(filtered);
  }, [favorites]);

  const toggleFavorite = useCallback(async (entityType, entityId, entityName) => {
    if (isFavorite(entityType, entityId)) {
      await removeFavorite(entityType, entityId);
    } else {
      await addFavorite(entityType, entityId, entityName);
    }
  }, [isFavorite, addFavorite, removeFavorite]);

  const value = useMemo(() => ({
    favorites,
    loading,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
  }), [favorites, loading, isFavorite, addFavorite, removeFavorite, toggleFavorite]);

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
