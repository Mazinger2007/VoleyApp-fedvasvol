/* eslint-disable no-console */
const {
  fetchTournamentsContext,
  seasonOptions,
  fetchSeasonTournamentsHtml,
  fetchSeasonTournamentsAjax,
} = require('./fedvas-sync');

function getArg(args, name, fallback = null) {
  const idx = args.findIndex((a) => a === `--${name}`);
  if (idx < 0) return fallback;
  const value = args[idx + 1];
  if (!value || value.startsWith('--')) return true;
  return value;
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

async function timed(label, fn) {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const ms = Number(end - start) / 1e6;
  return { label, ms, result };
}

async function main() {
  const args = process.argv.slice(2);
  const limitSeasons = Number(getArg(args, 'limitSeasons', '4')) || 4;
  const runs = Number(getArg(args, 'runs', '2')) || 2;

  const { dom: rootDom, csrfToken, cookieHeader } = await fetchTournamentsContext();
  const seasons = seasonOptions(rootDom).slice(0, Math.max(1, limitSeasons));

  if (!seasons.length) {
    throw new Error('No se encontraron temporadas para benchmark');
  }

  console.log(`[benchmark] temporadas=${seasons.length}, runs=${runs}, csrf=${csrfToken ? 'ok' : 'missing'}`);

  const htmlTimes = [];
  const ajaxTimes = [];
  let htmlRows = 0;
  let ajaxRows = 0;

  for (const season of seasons) {
    for (let run = 1; run <= runs; run += 1) {
      const htmlTry = await timed('html', () => fetchSeasonTournamentsHtml(season.id));
      htmlTimes.push(htmlTry.ms);
      htmlRows += htmlTry.result.tournaments.length;

      console.log(`[html] season=${season.id} run=${run}/${runs} ms=${htmlTry.ms.toFixed(1)} rows=${htmlTry.result.tournaments.length}`);

      if (csrfToken) {
        const ajaxTry = await timed('ajax', () => fetchSeasonTournamentsAjax(season.id, csrfToken, cookieHeader));
        ajaxTimes.push(ajaxTry.ms);
        ajaxRows += ajaxTry.result.tournaments.length;
        console.log(`[ajax] season=${season.id} run=${run}/${runs} ms=${ajaxTry.ms.toFixed(1)} rows=${ajaxTry.result.tournaments.length}`);
      }
    }
  }

  const summary = {
    html: {
      samples: htmlTimes.length,
      avgMs: avg(htmlTimes),
      medianMs: median(htmlTimes),
      totalRows: htmlRows,
    },
    ajax: {
      samples: ajaxTimes.length,
      avgMs: avg(ajaxTimes),
      medianMs: median(ajaxTimes),
      totalRows: ajaxRows,
    },
  };

  console.log('\n=== BENCHMARK SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));

  if (!ajaxTimes.length) {
    console.log('\n[decision] No se pudo medir AJAX (csrf ausente). Usar método html.');
    return;
  }

  const fastest = summary.ajax.medianMs <= summary.html.medianMs ? 'ajax' : 'html';
  const diff = ((summary.html.medianMs - summary.ajax.medianMs) / summary.html.medianMs) * 100;

  if (fastest === 'ajax') {
    console.log(`\n[decision] FASTEST=ajax (${Math.abs(diff).toFixed(1)}% mejor por mediana)`);
  } else {
    console.log(`\n[decision] FASTEST=html (${Math.abs(diff).toFixed(1)}% mejor por mediana)`);
  }
}

main().catch((error) => {
  console.error('[fatal]', error.message);
  process.exitCode = 1;
});
