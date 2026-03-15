// src/utils/htmlParser.js
// Utilidad central para descargar y parsear el HTML de la federación.
// Usa htmlparser2 + domutils para recorrer el DOM sin ningún CSS original.

import axios from 'axios';
import * as htmlparser2 from 'htmlparser2';
import * as DomUtils from 'domutils';

// ─── URLs base de la Federación Vasca de Voleibol ───────────────────────────
export const BASE_URL = 'https://fedvasvol.com';

export const URLS = {
  // Home de la app: competiciones (tu página principal objetivo)
  home: 'https://fedvasvol.com/es/tournaments',
  competitions: 'https://fedvasvol.com/es/tournaments',
  teams: 'https://fedvasvol.com/es/information',
  results: 'https://fedvasvol.com/es/tournaments',
};

// ─── Helpers de URL ─────────────────────────────────────────────────────────
export function toAbsoluteUrl(href = '') {
  if (!href || typeof href !== 'string') return '';
  if (/^https?:\/\//i.test(href)) return href;
  return `${BASE_URL}${href.startsWith('/') ? href : `/${href}`}`;
}

export function toTournamentRankingUrl(inputUrl = '') {
  if (!inputUrl) return '';

  const absolute = toAbsoluteUrl(inputUrl);
  const normalized = absolute
    .replace(/\/summary(?:\/.*)?$/i, '/ranking')
    .replace(/\/information(?:\/.*)?$/i, '/ranking')
    .replace(/\/calendar(?:\/\d+)?(?:\/.*)?$/i, '/ranking');

  if (/\/ranking(?:\/\d+)?$/i.test(normalized)) {
    // Fuerza /ranking base para obtener navegación y detectar calendario activo
    return normalized.replace(/\/ranking(?:\/\d+)?$/i, '/ranking');
  }

  const match = normalized.match(/^(https?:\/\/[^/]+\/[a-z]{2}\/tournament\/\d+)/i);
  return match ? `${match[1]}/ranking` : normalized;
}

export function toTournamentInformationUrl(inputUrl = '') {
  if (!inputUrl) return '';

  const absolute = toAbsoluteUrl(inputUrl);
  const normalized = absolute
    .replace(/\/summary(?:\/.*)?$/i, '/information')
    .replace(/\/ranking(?:\/\d+)?(?:\/.*)?$/i, '/information')
    .replace(/\/calendar(?:\/\d+)?(?:\/all)?(?:\/.*)?$/i, '/information');

  if (/\/information(?:\/.*)?$/i.test(normalized)) {
    return normalized.replace(/\/information(?:\/.*)?$/i, '/information');
  }

  const match = normalized.match(/^(https?:\/\/[^/]+\/[a-z]{2}\/tournament\/\d+)/i);
  return match ? `${match[1]}/information` : normalized;
}

function stripHtml(value = '') {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSeasonFromInformationHtml(html = '') {
  if (!html) return null;

  const sectionMatch = html.match(/Temporada\s*<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/i);
  if (sectionMatch?.[1]) {
    const value = stripHtml(sectionMatch[1]);
    if (value) return value;
  }

  const genericMatch = html.match(/Temporada[^\n\r<]*([12][0-9]{3}\s*\/\s*[12][0-9]{3})/i);
  if (genericMatch?.[1]) {
    return genericMatch[1].replace(/\s+/g, '');
  }

  return null;
}

export async function discoverTournamentSeasonLabel(inputUrl = '') {
  const informationUrl = toTournamentInformationUrl(inputUrl);
  if (!informationUrl) return null;

  const html = await fetchHTML(informationUrl);
  return extractSeasonFromInformationHtml(html);
}

export async function discoverCalendarUrlFromRanking(rankingUrl = '') {
  const baseRanking = toTournamentRankingUrl(rankingUrl);
  if (!baseRanking) return null;

  const html = await fetchHTML(baseRanking);

  const absoluteAll = html.match(/https?:\/\/[^"'\s]+\/[a-z]{2}\/tournament\/\d+\/calendar\/\d+\/all/i)?.[0];
  if (absoluteAll) return absoluteAll;

  const absolute = html.match(/https?:\/\/[^"'\s]+\/[a-z]{2}\/tournament\/\d+\/calendar\/\d+/i)?.[0];
  if (absolute) return `${absolute.replace(/\/+$/, '')}/all`;

  const relativeAll = html.match(/\/[a-z]{2}\/tournament\/\d+\/calendar\/\d+\/all/i)?.[0];
  if (relativeAll) return toAbsoluteUrl(relativeAll);

  const relative = html.match(/\/[a-z]{2}\/tournament\/\d+\/calendar\/\d+/i)?.[0];
  if (relative) return `${toAbsoluteUrl(relative).replace(/\/+$/, '')}/all`;

  const rankingGroup = html.match(/\/[a-z]{2}\/tournament\/(\d+)\/ranking\/(\d+)/i);
  if (rankingGroup?.[1] && rankingGroup?.[2]) {
    const locale = baseRanking.match(/https?:\/\/[^/]+\/(\w{2})\//i)?.[1] || 'en';
    return `${BASE_URL}/${locale}/tournament/${rankingGroup[1]}/calendar/${rankingGroup[2]}/all`;
  }

  return null;
}

// ─── Tags que se eliminan completamente (con todo su contenido) ───────────────
const REMOVE_TAGS = new Set([
  'style', 'script', 'link', 'meta', 'head',
  'noscript', 'iframe', 'svg', 'canvas', 'form',
  'input', 'button', 'select', 'textarea', 'nav',
  'footer', 'aside',
]);

// ─── Tags de los que solo se extrae el texto plano ──────────────────────────
const INLINE_TAGS = new Set([
  'span', 'strong', 'em', 'b', 'i', 'u', 'small',
  'sup', 'sub', 'abbr', 'cite', 'code',
]);

// ─── Descarga el HTML de una URL y lo devuelve como string ──────────────────
export async function fetchHTML(url) {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        // Simula un navegador estándar para evitar bloqueos simples
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Error descargando ${url}: ${error.message}`);
  }
}

// ─── Parsea el HTML y devuelve el DOM raíz (objetos domhandler) ──────────────
export function parseHTML(html) {
  return htmlparser2.parseDocument(html);
}

// ─── Elimina nodos que pertenecen a tags prohibidos ──────────────────────────
function shouldRemoveNode(node) {
  return (
    node.type === 'comment' ||
    (node.type === 'tag' && REMOVE_TAGS.has(node.name))
  );
}

// ─── Extrae el texto limpio de un nodo (recursivo) ───────────────────────────
export function getTextContent(node) {
  if (!node) return '';
  if (node.type === 'text') return node.data.replace(/\s+/g, ' ').trim();
  if (node.children) {
    return node.children
      .map(getTextContent)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return '';
}

// ─── Convierte el DOM en una lista de bloques de contenido estructurado ──────
// Cada bloque tiene: { type, content, level?, href?, rows?, headers? }
export function domToBlocks(node, blocks = []) {
  if (!node || shouldRemoveNode(node)) return blocks;

  if (node.type === 'tag') {
    const tag = node.name;

    // Encabezados
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
      const text = getTextContent(node).trim();
      if (text.length > 2) {
        blocks.push({
          type: 'heading',
          level: parseInt(tag[1], 10),
          content: text,
        });
      }
      return blocks;
    }

    // Párrafos
    if (tag === 'p') {
      const text = getTextContent(node).trim();
      if (text.length > 3) {
        blocks.push({ type: 'paragraph', content: text });
      }
      return blocks;
    }

    // Listas
    if (tag === 'ul' || tag === 'ol') {
      const items = DomUtils.findAll(
        (n) => n.type === 'tag' && n.name === 'li',
        node.children || []
      ).map((li) => getTextContent(li).trim()).filter((t) => t.length > 0);

      if (items.length > 0) {
        blocks.push({ type: 'list', ordered: tag === 'ol', items });
      }
      return blocks;
    }

    // Tablas
    if (tag === 'table') {
      const tableBlock = parseTable(node);
      if (tableBlock) blocks.push(tableBlock);
      return blocks;
    }

    // Artículos y divs: recursar en hijos
    if (
      ['article', 'section', 'main', 'div', 'body', 'html'].includes(tag) ||
      (node.attribs && (node.attribs.class || node.attribs.id))
    ) {
      (node.children || []).forEach((child) => domToBlocks(child, blocks));
      return blocks;
    }

    // Anclas (links)
    if (tag === 'a') {
      const text = getTextContent(node).trim();
      const href = node.attribs?.href || '';
      const absHref = toAbsoluteUrl(href);
      const isTournamentRoute = /\/tournament\/\d+\/(ranking|calendar|summary|information)(?:\/\d+)?/i.test(absHref);
      if ((text.length > 2 || isTournamentRoute) && href && !href.startsWith('#')) {
        blocks.push({
          type: 'link',
          content: text || absHref,
          href: absHref,
        });
      }
      return blocks;
    }

    // Para cualquier otro tag: recursar en hijos
    (node.children || []).forEach((child) => domToBlocks(child, blocks));
  }

  return blocks;
}

// ─── Parsea una tabla HTML y devuelve un bloque tipo 'table' ─────────────────
function parseTable(tableNode) {
  const rows = DomUtils.findAll(
    (n) => n.type === 'tag' && n.name === 'tr',
    tableNode
  );

  if (rows.length === 0) return null;

  // Primera fila como encabezados
  const firstRowCells = DomUtils.findAll(
    (n) => n.type === 'tag' && (n.name === 'th' || n.name === 'td'),
    rows[0]
  );
  const headers = firstRowCells.map((cell) => extractCellText(cell));

  // Resto de filas como datos + link de fila (si existe)
  const parsedRows = rows.slice(1).map((row) => {
    const cells = DomUtils.findAll(
      (n) => n.type === 'tag' && (n.name === 'th' || n.name === 'td'),
      row
    );

    const firstLink = DomUtils.findOne(
      (n) => n.type === 'tag' && n.name === 'a' && n.attribs?.href,
      row.children || []
    );
    const href = firstLink?.attribs?.href ? toAbsoluteUrl(firstLink.attribs.href) : null;

    const rowData = {
      cells: cells.map((cell) => extractCellText(cell)),
      href,
      image: extractRowPrimaryImage(row),
    };

    const match = parseMatchRow(row);
    if (match) rowData.match = match;

    return rowData;
  });

  // Filtra filas completamente vacías
  const filteredRows = parsedRows.filter((row) =>
    row.cells.some((cell) => cell.length > 0)
  );

  if (headers.length === 0 && filteredRows.length === 0) return null;

  return {
    type: 'table',
    headers,
    rows: filteredRows.map((r) => r.cells),
    rowLinks: filteredRows.map((r) => r.href),
    rowImages: filteredRows.map((r) => r.image),
    rowLogos: filteredRows.map((r) => r.image),
    matches: filteredRows.map((r) => r.match).filter(Boolean),
  };
}

function getNodeClass(node) {
  return (node?.attribs?.class || '').toLowerCase();
}

function normalizeTeamLogoUrl(url = '') {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const isLeveradeThumb = /cdn\.leverade\.com$/i.test(parsed.hostname)
      && /\/thumbnails\//i.test(parsed.pathname);

    if (!isLeveradeThumb) return url;

    parsed.pathname = parsed.pathname.replace(
      /\.\d+x\d+(?=\.[a-zA-Z0-9]+$)/,
      ''
    );

    return parsed.toString();
  } catch (_) {
    return url.replace(/\.\d+x\d+(?=\.[a-zA-Z0-9]+(?:[?#].*)?$)/, '');
  }
}

function extractRowPrimaryImage(rowNode) {
  if (!rowNode) return null;

  const rowImgs = DomUtils.findAll(
    (n) => n.type === 'tag' && n.name === 'img',
    rowNode.children || []
  );

  const urls = rowImgs
    .map((img) => toAbsoluteUrl(img?.attribs?.src || img?.attribs?.['data-src'] || ''))
    .map((url) => normalizeTeamLogoUrl(url))
    .filter(Boolean);

  if (!urls.length) return null;

  const preferred = urls.find((url) =>
    /thumbnail|logo|escudo|team|club|player|jugador|avatar|profile/i.test(url)
  );

  return preferred || urls[0] || null;
}

function parseTeamCell(cellNode) {
  if (!cellNode) return null;

  const titleSpans = DomUtils.findAll(
    (n) => n.type === 'tag' && n.name === 'span' && /\bellipsis\b/i.test(getNodeClass(n)),
    cellNode.children || []
  );

  const names = titleSpans
    .map((n) => n.attribs?.title?.trim() || getTextContent(n).trim())
    .filter(Boolean);

  const logoImgs = DomUtils.findAll(
    (n) => n.type === 'tag' && n.name === 'img',
    cellNode.children || []
  );

  const logos = logoImgs
    .map((img) => toAbsoluteUrl(img?.attribs?.src || img?.attribs?.['data-src'] || ''))
    .map((logoUrl) => normalizeTeamLogoUrl(logoUrl))
    .filter(Boolean);

  if (names.length >= 2) {
    return {
      homeTeam: names[0],
      awayTeam: names[1],
      homeLogo: logos[0] || null,
      awayLogo: logos[1] || null,
    };
  }

  return null;
}

function parsePeriodsCell(cellNode) {
  if (!cellNode) return null;

  const verticalResults = DomUtils.findAll(
    (n) => n.type === 'tag' && n.name === 'span' && /\bvertical-result\b/i.test(getNodeClass(n)),
    cellNode.children || []
  );

  if (!verticalResults.length) return null;

  const parsedColumns = verticalResults.map((node) => {
    const partials = DomUtils.findAll(
      (n) => n.type === 'tag' && n.name === 'span' && /\bpartial-result\b/i.test(getNodeClass(n)),
      node.children || []
    ).map((n) => {
      const raw = getTextContent(n).replace(/\s+/g, ' ').trim();
      const value = raw.replace(/[-‐‑‒–—―]+/g, '').trim();
      return value || null;
    });

    return {
      home: partials[0] ?? null,
      away: partials[1] ?? null,
    };
  });

  const sets = parsedColumns.slice(1, 6).map((set, index) => ({
    number: index + 1,
    home: set.home,
    away: set.away,
  }));

  return {
    matchScore: parsedColumns[0] || { home: null, away: null },
    sets,
  };
}

function parseDateCell(cellNode) {
  if (!cellNode) return null;

  const span = DomUtils.findOne((n) => n.type === 'tag' && n.name === 'span', cellNode.children || []);
  if (!span) return getTextContent(cellNode).trim() || null;

  const venueSpan = DomUtils.findOne(
    (n) => n.type === 'tag' && n.name === 'span' && /\bellipsis\b/i.test(getNodeClass(n)),
    span.children || []
  );
  const venue = venueSpan?.attribs?.title?.trim() || null;

  const dateText = getTextContent(span)
    .replace(venue || '', '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    date: dateText || null,
    venue,
  };
}

function parseMatchRow(rowNode) {
  const cells = DomUtils.findAll(
    (n) => n.type === 'tag' && (n.name === 'th' || n.name === 'td'),
    rowNode.children || []
  );

  if (!cells.length) return null;

  const teamCell = cells.find((cell) => /colstyle-equipo/.test(getNodeClass(cell)));
  const periodsCell = cells.find((cell) => /colstyle-parciales/.test(getNodeClass(cell)));
  const dateCell = cells.find((cell) => /colstyle-fecha/.test(getNodeClass(cell)));

  const teams = parseTeamCell(teamCell);
  const periods = parsePeriodsCell(periodsCell);
  const dateData = parseDateCell(dateCell);

  if (!teams || !periods) return null;

  return {
    ...teams,
    date: dateData?.date || null,
    venue: dateData?.venue || null,
    matchScore: periods.matchScore,
    sets: periods.sets,
  };
}

// ─── Extrae mejor el texto de una celda de tabla ─────────────────────────────
// Casos cubiertos para fedvasvol:
// - celdas con iconos <i title="En curso"> sin texto visible
// - celdas con enlace + <span class="sr-only">Ver</span>
function extractCellText(cellNode) {
  if (!cellNode) return '';

  const raw = getTextContent(cellNode).trim();

  // Título del icono (ej: "En curso", "Configurando")
  const icon = DomUtils.findOne(
    (n) => n.type === 'tag' && n.name === 'i' && n.attribs?.title,
    cellNode.children || []
  );
  const iconTitle = icon?.attribs?.title?.trim() || '';

  // Quita texto auxiliar típico (sr-only)
  const cleaned = raw.replace(/\bVer\b/gi, '').replace(/\s+/g, ' ').trim();

  // Si no hay texto útil pero sí icono con title, usa el title
  if (!cleaned && iconTitle) return iconTitle;

  // Si sólo hay "Ver" y también title, prioriza title
  if (/^ver$/i.test(raw) && iconTitle) return iconTitle;

  return cleaned || iconTitle || '';
}

// ─── Función principal: URL → array de bloques listos para renderizar ─────────
export async function fetchAndParse(url) {
  const html = await fetchHTML(url);
  const dom = parseHTML(html);

  // Busca el <body> o usa el documento completo
  const body =
    DomUtils.findOne((n) => n.type === 'tag' && n.name === 'body', dom.children) ||
    dom;

  const blocks = domToBlocks(body);

  // Elimina bloques duplicados consecutivos
  return blocks.filter((block, i) => {
    if (i === 0) return true;
    const prev = blocks[i - 1];
    return !(
      prev.type === block.type &&
      prev.content === block.content
    );
  });
}
