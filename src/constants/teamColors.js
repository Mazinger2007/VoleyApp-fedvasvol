import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';

// --- INITIAL FALLBACK DATA ---
export let CLUB_BASE_COLORS = {};
export let OFFICIAL_CHANNELS = [];
export let CLUB_BASES = [];
// ------------------------------

/**
 * Inicializa y carga los datos de equipos desde Supabase,
 * con caché en AsyncStorage para un inicio rápido.
 */
export async function initTeamsData() {
  try {
    const cachedData = await AsyncStorage.getItem('teams_data_cache');
    if (cachedData) {
      applyTeamsData(JSON.parse(cachedData));
    }

    const { data: teamsData, error } = await supabase
      .from('teams_data')
      .select('*');

    if (!error && teamsData) {
      applyTeamsData(teamsData);
      await AsyncStorage.setItem('teams_data_cache', JSON.stringify(teamsData));
      console.log('[TeamsData] ✅ Datos de equipos actualizados desde Supabase');
    } else if (error) {
      console.log('[TeamsData] ⚠️ Error al obtener teams_data:', JSON.stringify({ code: error.code, message: error.message, details: error.details, hint: error.hint }));
    }
  } catch (error) {
    console.warn('[TeamsData] Error en initTeamsData:', error);
  }
}

function applyTeamsData(teamsData) {
  const newColors = {};
  const newChannels = [];
  const newBases = [];

  teamsData.forEach(row => {
    if (row.base_name) {
      newBases.push(row.base_name);
    }
    if (row.color) {
      newColors[row.base_name] = row.color;
    }
    if (row.youtube_id && row.youtube_patterns && row.youtube_patterns.length > 0) {
      newChannels.push({
        baseName: row.base_name,
        name: row.youtube_name || row.base_name,
        id: row.youtube_id,
        patterns: row.youtube_patterns.map(p => new RegExp(p, 'i')),
        priority: row.youtube_priority || false
      });
    }
  });

  CLUB_BASE_COLORS = newColors;
  OFFICIAL_CHANNELS = newChannels;
  CLUB_BASES = newBases;
}

/**
 * Obtiene el nombre base del club para un equipo dado.
 */
export function getClubBaseName(teamName) {
  if (!teamName) return null;
  const upperName = teamName.toUpperCase();
  const baseName = CLUB_BASES.find(base => upperName.includes(base.toUpperCase()));
  return baseName || null;
}

/**
 * Obtiene el color de un equipo basándose en su nombre base (Club).
 * Realiza una búsqueda por subcadena (case-insensitive).
 */
export function getTeamColor(teamName, fallback = "#000000ff") {
  const baseName = getClubBaseName(teamName);
  const color = baseName ? CLUB_BASE_COLORS[baseName] : null;
  return color || fallback;
}
