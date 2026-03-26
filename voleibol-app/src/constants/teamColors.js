/**
 * Diccionario de colores corporativos por CLUB (Base).
 * Se usa búsqueda por subcadena: si el nombre del equipo contiene la clave,
 * se aplica el color. Esto soluciona el problema de los patrocinadores.
 */
export const CLUB_BASE_COLORS = {
  // --- CLUBES BASE (Editar códigos HEX aquí) ---
  "OCISA": "#36906D",
  "AIDEAN": "#E65900",
  "ARMENTIA": "#F46B27",
  "ARIZMENDI": "#8C2377",
  "BERA BERA": "#3173C7",
  "CARMELITAS": "#0B87DD",
  "DIOS": "#55B9E1",
  "EGIBIDE": "#80005D",
  "EKIALDE": "#5081D0",
  "FORTUNA": "#FA6D28",
  "GALDAKAO": "#0277B7",
  "GALLARTA": "#008300",
  "GETXO": "#8B0135",
  "HERNANI": "#2F2F2F",
  "JATORKIDE": "#592e77",
  "KOLDO": "#EEE300",
  "LEKEITIO": "#EC990D",
  "LOGROÑO": "#941109",
  "MARIANISTAS": "#E02512",
  "MENDEBALDEA": "#743409",
  "MERCEDARIAS": "#253769",
  "NAVARVOLEY": "#DF2F2F",
  "OSTADAR": "#7A5F38",
  "OTSOKUMEAK": "#515151",
  "REKALDE": "#032A75",
  "SANTANDER": "#C20E1A",
  "SESTAO": "#0D5427",
  "UNAMUNO": "",
  "ZABALGANA": "#743409",

  // Añade más clubes base aquí en MAYÚSCULAS
};

/**
 * Obtiene el nombre base del club para un equipo dado.
 */
export function getClubBaseName(teamName) {
  if (!teamName) return null;
  const upperName = teamName.toUpperCase();
  const entry = Object.entries(CLUB_BASE_COLORS).find(([baseName]) =>
    upperName.includes(baseName.toUpperCase())
  );
  return entry ? entry[0] : null;
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
