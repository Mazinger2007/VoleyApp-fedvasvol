import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';

// --- INITIAL FALLBACK DATA ---
export let CLUB_BASE_COLORS = {};
export let OFFICIAL_CHANNELS = [];
export let CLUB_BASES = [];
export let LAST_TEAMS_ERROR = null;
const _colorListeners = new Set();
export function subscribeColors(cb) {
  _colorListeners.add(cb);
  return () => _colorListeners.delete(cb);
}
// ------------------------------

/**
 * Inicializa y carga los datos de equipos desde Supabase,
 * con caché en AsyncStorage para un inicio rápido.
 */
export async function initTeamsData() {
  try {
    const cachedData = await AsyncStorage.getItem('teams_data_cache');
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      if (parsed.length > 0) {
        applyTeamsData(parsed);
      }
    }

    // Intentar con el nombre exacto de la tabla: teams_data
    const { data: teamsData, error } = await supabase
      .from('teams_data')
      .select('*');

    if (error) {
      LAST_TEAMS_ERROR = { code: error.code, message: error.message, details: error.details, hint: error.hint };
      console.log('[TeamsData] ⚠️ Error:', JSON.stringify(LAST_TEAMS_ERROR));
      // Si la tabla no se encontró, limpiar caché para reintentar
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        await AsyncStorage.removeItem('teams_data_cache');
      }
    } else if (teamsData && teamsData.length > 0) {
      LAST_TEAMS_ERROR = null;
      applyTeamsData(teamsData);
      await AsyncStorage.setItem('teams_data_cache', JSON.stringify(teamsData));
      console.log('[TeamsData] ✅ Datos actualizados (' + teamsData.length + ' equipos)');
    } else {
      LAST_TEAMS_ERROR = { message: 'Query returned 0 rows — posible RLS o nombre de tabla incorrecto' };
      console.warn('[TeamsData] ⚠️', LAST_TEAMS_ERROR.message);
    }
  } catch (error) {
    LAST_TEAMS_ERROR = { message: error.message };
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
  _colorListeners.forEach(cb => cb());
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
export function getTeamColor(teamName, fallback = "#001f3d") {
  const baseName = getClubBaseName(teamName);
  const color = baseName ? CLUB_BASE_COLORS[baseName] : null;
  return color || fallback;
}
