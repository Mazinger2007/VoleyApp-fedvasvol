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
  reorderFavorites: async () => {},
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
          .select('entity_type, entity_id, sort_order, created_at')
          .eq('user_id', user.id)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });

        if (!error && dbFavs) {
          const mapped = dbFavs.map((f, i) => ({
            entityType: f.entity_type,
            entityId: f.entity_id,
            sortOrder: f.sort_order ?? i,
            createdAt: new Date(f.created_at).getTime(),
          }));

          const localMap = new Map(localFavs.map(f => [`${f.entityType}:${f.entityId}`, f]));
          mapped.forEach(f => {
            if (!localMap.has(`${f.entityType}:${f.entityId}`)) {
              localMap.set(`${f.entityType}:${f.entityId}`, f);
            }
          });

          const merged = Array.from(localMap.values())
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          merged.forEach((f, i) => { if (f.sortOrder === undefined) f.sortOrder = i; });

          const grouped = [
            ...merged.filter(f => f.entityType === 'league' || f.entityType === 'competition'),
            ...merged.filter(f => f.entityType === 'team'),
          ];
          const reindexed = grouped.map((f, i) => ({ ...f, sortOrder: i }));
          setFavorites(reindexed);
          await AsyncStorage.setItem(localKey, JSON.stringify(reindexed));

          for (const fav of localFavs) {
            const exists = dbFavs.some(f => f.entity_type === fav.entityType && f.entity_id === fav.entityId);
            if (!exists) {
              await supabase.from('favorites').upsert({
                user_id: user.id,
                entity_type: fav.entityType,
                entity_id: fav.entityId,
                sort_order: fav.sortOrder ?? 0,
              }, { onConflict: 'user_id,entity_type,entity_id' });
            }
          }
          return;
        }
      }

      const sortedLocal = localFavs.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const groupedLocal = [
        ...sortedLocal.filter(f => f.entityType === 'league' || f.entityType === 'competition'),
        ...sortedLocal.filter(f => f.entityType === 'team'),
      ];
      setFavorites(groupedLocal.map((f, i) => ({ ...f, sortOrder: i })));
    } catch (e) {
      console.warn('[Favorites] Load failed:', e);
    } finally {
      setLoading(false);
    }
  }

  async function persist(newFavorites) {
    // Reindex: leagues/competitions first, then teams — so sort_order
    // in the database matches the visual order (ligas arriba, equipos abajo).
    const grouped = [
      ...newFavorites.filter(f => f.entityType === 'league' || f.entityType === 'competition'),
      ...newFavorites.filter(f => f.entityType === 'team'),
    ];
    const reindexed = grouped.map((f, i) => ({ ...f, sortOrder: i }));
    setFavorites(reindexed);
    const localKey = user ? `${STORAGE_KEY}_${user.id}` : STORAGE_KEY;
    await AsyncStorage.setItem(localKey, JSON.stringify(reindexed));

    if (user) {
      try {
        const { data: dbFavs } = await supabase
          .from('favorites')
          .select('entity_type, entity_id')
          .eq('user_id', user.id);

        const dbSet = new Set((dbFavs || []).map(f => `${f.entity_type}:${f.entity_id}`));
        const localSet = new Set(reindexed.map(f => `${f.entityType}:${f.entityId}`));

        for (const [i, fav] of reindexed.entries()) {
          const key = `${fav.entityType}:${fav.entityId}`;
          const payload = {
            user_id: user.id,
            entity_type: fav.entityType,
            entity_id: fav.entityId,
            sort_order: fav.sortOrder ?? i,
          };
          if (!dbSet.has(key)) {
            await supabase.from('favorites').upsert(payload, { onConflict: 'user_id,entity_type,entity_id' });
          } else {
            await supabase.from('favorites').update(payload)
              .eq('user_id', user.id)
              .eq('entity_type', fav.entityType)
              .eq('entity_id', fav.entityId);
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
    const sortOrder = favorites.length;
    const newFav = { entityType, entityId, entityName, sortOrder, createdAt: Date.now() };
    await persist([...favorites, newFav]);
  }, [favorites, isFavorite]);

  const removeFavorite = useCallback(async (entityType, entityId) => {
    const filtered = favorites.filter(f => !(f.entityType === entityType && f.entityId === entityId));
    const reindexed = filtered.map((f, i) => ({ ...f, sortOrder: i }));
    await persist(reindexed);
  }, [favorites]);

  const toggleFavorite = useCallback(async (entityType, entityId, entityName) => {
    if (isFavorite(entityType, entityId)) {
      await removeFavorite(entityType, entityId);
    } else {
      await addFavorite(entityType, entityId, entityName);
    }
  }, [isFavorite, addFavorite, removeFavorite]);

  const reorderFavorites = useCallback(async (fromIdx, toIdx) => {
    const updated = [...favorites];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    const reindexed = updated.map((f, i) => ({ ...f, sortOrder: i }));
    await persist(reindexed);
  }, [favorites]);

  const value = useMemo(() => ({
    favorites,
    loading,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    reorderFavorites,
  }), [favorites, loading, isFavorite, addFavorite, removeFavorite, toggleFavorite, reorderFavorites]);

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
