const axios = require('axios');

const leagues = [
  { name: 'Euskal Liga 1 Femenina', url: 'https://fedvasvol.com/es/tournament/1315743/calendar/3637244/all?season=8404' },
  { name: 'Liga Vasca 2 Femenina', url: 'https://fedvasvol.com/es/tournament/1315855/calendar/3637456/all?season=8404' },
  { name: 'Liga Vasca 1 Masculina', url: 'https://fedvasvol.com/es/tournament/1315744/calendar/3637245/all?season=8404' },
];

async function getTeams(url) {
  try {
    const r = await axios.get(url, { timeout: 10000 });
    const teams = new Set();
    // Try class="team-name"
    const matches = r.data.matchAll(/class="team-name"[^>]*>([^<]+)</g);
    for (const m of matches) teams.add(m[1].trim());
    // Fallback: look for data-team attributes
    const matches2 = r.data.matchAll(/data-team-name="([^"]+)"/g);
    for (const m of matches2) teams.add(m[1].trim());
    return [...teams];
  } catch(e) {
    return ['ERROR: ' + e.message];
  }
}

(async () => {
  for (const l of leagues) {
    const teams = await getTeams(l.url);
    console.log('\n=== ' + l.name + ' (' + teams.length + ' equipos) ===');
    teams.forEach((t, i) => console.log(' ' + (i+1) + '.', t));
  }
})();
