// ============================================================
// Script de migración para recrear la base de datos Supabase
// Uso: node scripts/migrate-db.mjs
//
// Requisitos:
//   1. Tener un proyecto Supabase activo
//   2. Actualizar .env con las nuevas credenciales
//   3. Ejecutar: npm install @supabase/supabase-js (ya instalado)
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');

// Cargar variables de entorno desde .env
function loadEnv() {
  if (!existsSync(envPath)) {
    console.error('No se encuentra .env en', envPath);
    process.exit(1);
  }
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    process.env[key] = value;
  }
}

loadEnv();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_KEY en .env');
  process.exit(1);
}

console.log(`Conectando a: ${supabaseUrl}`);

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// DATOS COMPLETOS
// ============================================================

const teamsData = [
  { base_name: 'OCISA',       color: '#36906D', venue_lat: null, venue_lon: null, youtube_id: 'UC9bIaWAOGv4hGkGgN-FDnhQ', youtube_patterns: ['logrono','logroño'],                             youtube_name: 'Ocisa Logroño',         youtube_priority: false },
  { base_name: 'AIDEAN',      color: '#E65900', venue_lat: null, venue_lon: null, youtube_id: 'UChXUSuJD-XCLjmFZUYcCtVg', youtube_patterns: ['aidean'],                                      youtube_name: 'Aidean ZKE',            youtube_priority: false },
  { base_name: 'AIXERROTA',   color: '#8B0135', venue_lat: 43.3705, venue_lon: -3.0039, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'ARMENTIA',    color: '#F46B27', venue_lat: null, venue_lon: null, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'ARIZMENDI',   color: '#8C2377', venue_lat: null, venue_lon: null, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'BERA BERA',   color: '#3173C7', venue_lat: null, venue_lon: null, youtube_id: 'UCs8IABn1087s4X_xrHCHbJQ', youtube_patterns: ['bera bera','berabera'],                       youtube_name: 'Bera Bera',             youtube_priority: false },
  { base_name: 'CARMELITAS',  color: '#0B87DD', venue_lat: null, venue_lon: null, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'DIOS',        color: '#55B9E1', venue_lat: null, venue_lon: null, youtube_id: 'UCxGbXULdYqJJTn97vBhK8cw', youtube_patterns: ['madre de dios','madi','deusto'],              youtube_name: 'Madre de Dios Deusto',  youtube_priority: false },
  { base_name: 'EGIBIDE',     color: '#80005D', venue_lat: null, venue_lon: null, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'EKIALDE',     color: '#5081D0', venue_lat: null, venue_lon: null, youtube_id: 'UCEeow14MIifOsTXS4uSCB5g', youtube_patterns: ['ekialde'],                                     youtube_name: 'Cafés Foronda Ekialde', youtube_priority: false },
  { base_name: 'FORTUNA',     color: '#FA6D28', venue_lat: null, venue_lon: null, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'GALDAKAO',    color: '#0277B7', venue_lat: 43.2346, venue_lon: -2.8455, youtube_id: 'UCheRHnoAnFsI7Ogd9xSYAFQ', youtube_patterns: ['galdakao'],                             youtube_name: 'Galdakao',              youtube_priority: false },
  { base_name: 'GALLARTA',    color: '#008300', venue_lat: null, venue_lon: null, youtube_id: 'UCi0OUunq4dpoeIDnrRnKaiw', youtube_patterns: ['gallarta'],                                   youtube_name: 'Gallartaren Ahotsa',    youtube_priority: false },
  { base_name: 'GETXO',       color: '#8B0135', venue_lat: 43.3705, venue_lon: -3.0039, youtube_id: 'UCYHKUaL8kC4QDe5Cx7TgMyg', youtube_patterns: ['getxo'],                               youtube_name: 'Getxo',                 youtube_priority: true },
  { base_name: 'HERNANI',     color: '#2F2F2F', venue_lat: null, venue_lon: null, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'HRV',         color: '#003261', venue_lat: null, venue_lon: null, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'JATORKIDE',   color: '#592e77', venue_lat: 42.8534, venue_lon: -2.6712, youtube_id: 'UCDv0NQL_EFWtPC3i5v_Drbw', youtube_patterns: ['jatorkide'],                           youtube_name: 'Jatorkide',             youtube_priority: true },
  { base_name: 'KOLDO',       color: '#EEE300', venue_lat: null, venue_lon: null, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'LEKEITIO',    color: '#EC990D', venue_lat: null, venue_lon: null, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'LOGROÑO',     color: '#941109', venue_lat: null, venue_lon: null, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'MARIANISTAS', color: '#E02512', venue_lat: null, venue_lon: null, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'MENDEBALDEA', color: '#743409', venue_lat: null, venue_lon: null, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'MERCEDARIAS', color: '#253769', venue_lat: null, venue_lon: null, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'NAVARVOLEY',  color: '#DF2F2F', venue_lat: null, venue_lon: null, youtube_id: 'UC_utcf6nsss9TBzw0IkTs2w', youtube_patterns: ['navar'],                                     youtube_name: 'Navarvoley',            youtube_priority: false },
  { base_name: 'OSTADAR',     color: '#7A5F38', venue_lat: null, venue_lon: null, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'OTSOKUMEAK',  color: '#515151', venue_lat: null, venue_lon: null, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'REKALDE',     color: '#032A75', venue_lat: null, venue_lon: null, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'SANTANDER',   color: '#C20E1A', venue_lat: null, venue_lon: null, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'SESTAO',      color: '#0D5427', venue_lat: 43.3086, venue_lon: -3.0061, youtube_id: 'UC0RH2gitr2hjNYHhCENpzLg', youtube_patterns: ['sestao'],                               youtube_name: 'C.V.Sestao',            youtube_priority: false },
  { base_name: 'UNAMUNO',     color: null, venue_lat: null, venue_lon: null, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'ZABALGANA',   color: '#743409', venue_lat: null, venue_lon: null, youtube_id: null, youtube_patterns: null, youtube_name: null, youtube_priority: null },
  { base_name: 'TOLOBOLEI',   color: null, venue_lat: null, venue_lon: null, youtube_id: 'UC0e86MqCMbNFoJBCWbLyPxQ', youtube_patterns: ['tolobolei'],                                     youtube_name: 'Tolobolei',             youtube_priority: false },
];

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log(`Insertando ${teamsData.length} registros en teams_data...\n`);

  // Insertar en lotes de 10
  const batchSize = 10;
  let success = 0, errors = 0;

  for (let i = 0; i < teamsData.length; i += batchSize) {
    const batch = teamsData.slice(i, i + batchSize);
    const { error } = await supabase.from('teams_data').upsert(
      batch.map(row => ({
        ...row,
        youtube_patterns: row.youtube_patterns ? JSON.stringify(row.youtube_patterns) : null,
      })),
      { onConflict: 'base_name', ignoreDuplicates: false }
    );

    if (error) {
      console.error(`Error en lote ${i / batchSize + 1}:`, error.message);
      errors += batch.length;
    } else {
      success += batch.length;
      console.log(`  Lote ${i / batchSize + 1}: ${batch.length} registros OK`);
    }
  }

  console.log(`\n✅ Insertados: ${success}`);
  if (errors) console.log(`❌ Errores: ${errors}`);

  // Verificar
  console.log('\nVerificando datos...');
  const { data, error } = await supabase.from('teams_data').select('base_name, color, youtube_name').order('base_name');
  if (error) {
    console.error('Error al verificar:', error.message);
  } else {
    console.log(`Total en BD: ${data.length} registros\n`);
    console.log('Colores:');
    for (const row of data.filter(r => r.color)) {
      console.log(`  ${row.base_name.padEnd(12)} ${row.color}`);
    }
    console.log('\nYouTube:');
    for (const row of data.filter(r => r.youtube_name)) {
      console.log(`  ${row.base_name.padEnd(12)} → ${row.youtube_name}`);
    }
  }
}

main().catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
