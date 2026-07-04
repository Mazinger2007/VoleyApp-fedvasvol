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

  const readDbFavorites = useCallback(async () => {
    if (!user) return { data: null, error: null };

    const withName = await supabase
      .from('favorites')
      .select('entity_type, entity_id, entity_name, sort_order, created_at, updated_at')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!withName.error) return withName;

    // Backward compatibility for databases that have not run the entity_name migration yet.
    return supabase
      .from('favorites')
      .select('entity_type, entity_id, sort_order, created_at')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
  }, [user]);

  const writeDbFavorite = useCallback(async (payload, exists) => {
    const runWrite = (nextPayload) => {
      if (!exists) {
        return supabase.from('favorites').upsert(nextPayload, { onConflict: 'user_id,entity_type,entity_id' });
      }
      return supabase.from('favorites').update(nextPayload)
        .eq('user_id', user.id)
        .eq('entity_type', nextPayload.entity_type)
        .eq('entity_id', nextPayload.entity_id);
    };

    const first = await runWrite(payload);
    if (!first.error) return first;

    // Same migration guard as reads: keep favorites syncing even before DB schema is updated.
    const { entity_name: _entityName, updated_at: _updatedAt, ...fallbackPayload } = payload;
    return runWrite(fallbackPayload);
  }, [user]);

  async function loadFavorites() {
    try {
      const localKey = user ? `${STORAGE_KEY}_${user.id}` : STORAGE_KEY;
      const raw = await AsyncStorage.getItem(localKey);
      const localFavs = raw ? JSON.parse(raw) : [];

      if (user) {
        const { data: dbFavs, error } = await readDbFavorites();

        if (!error && dbFavs) {
          const mapped = dbFavs.map((f, i) => ({
            entityType: f.entity_type,
            entityId: f.entity_id,
            entityName: f.entity_name,
            sortOrder: f.sort_order ?? i,
            createdAt: new Date(f.created_at).getTime(),
            updatedAt: f.updated_at ? new Date(f.updated_at).getTime() : undefined,
          }));

          const localMap = new Map(localFavs.map(f => [`${f.entityType}:${f.entityId}`, f]));
          mapped.forEach(f => {
            const key = `${f.entityType}:${f.entityId}`;
            const local = localMap.get(key);
            if (!local) {
              localMap.set(key, f);
            } else {
              localMap.set(key, {
                ...local,
                ...f,
                entityName: f.entityName || local.entityName,
              });
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
              await writeDbFavorite({
                user_id: user.id,
                entity_type: fav.entityType,
                entity_id: fav.entityId,
                entity_name: fav.entityName || null,
                sort_order: fav.sortOrder ?? 0,
              }, false);
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

  useEffect(() => {
    loadFavorites();
  }, [user]);

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
        const { data: dbFavs } = await readDbFavorites();

        const dbSet = new Set((dbFavs || []).map(f => `${f.entity_type}:${f.entity_id}`));
        const localSet = new Set(reindexed.map(f => `${f.entityType}:${f.entityId}`));

        for (const [i, fav] of reindexed.entries()) {
          const key = `${fav.entityType}:${fav.entityId}`;
          const payload = {
            user_id: user.id,
            entity_type: fav.entityType,
            entity_id: fav.entityId,
            entity_name: fav.entityName || null,
            sort_order: fav.sortOrder ?? i,
            updated_at: new Date().toISOString(),
          };
          await writeDbFavorite(payload, dbSet.has(key));
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
    const newFav = { entityType, entityId, entityName: entityName || entityId, sortOrder, createdAt: Date.now(), updatedAt: Date.now() };
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
