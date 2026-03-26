const axios = require('axios');
const fs = require('fs');

async function extractClubs() {
  const tournamentsUrl = 'https://fedvasvol.com/es/tournaments';
  try {
    const { data: html } = await axios.get(tournamentsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const regex = /\/(?:es|en)\/tournament\/(\d+)/gi;
    const matches = [...html.matchAll(regex)];
    const tournamentIds = Array.from(new Set(matches.map(m => m[1])));
    
    const teamNames = new Set();
    const idsToTry = tournamentIds.slice(0, 15);
    
    for (const id of idsToTry) {
      const urls = [
        `https://fedvasvol.com/es/tournament/${id}/ranking`,
        `https://fedvasvol.com/es/tournament/${id}/calendar`
      ];
      for (const url of urls) {
        try {
          const { data: pageHtml } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
          const teamMatch = [...pageHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
          teamMatch.forEach(m => {
            const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            if (text.length > 3 && text.length < 50 && !/^\d+$/.test(text) && !/pos|pj|pg|pe|pp|pts|sets|pf|pc|dp|diff|fecha|jugado|puesto|equipo/i.test(text)) {
              teamNames.add(text);
            }
          });
        } catch (e) {}
      }
    }

    const noise = [
      / A$/, / B$/, / C$/, / D$/, / E$/, / F$/, / G$/,
      /^AD /, /^CD /, /^CV /, /^CVB /, /^Voley /, /^Club /,
      / Junior.*/i, / Senior.*/i, / Juvenil.*/i, / Cadete.*/i, / Infantil.*/i, / Alevin.*/i,
      / Femenino/i, / Masculino/i, / Mix/i,
      / Sugarra/i, / Cafes Foronda /i, / Ocisa /i, / Jatorkide /i
    ];

    const clubBases = new Set();
    Array.from(teamNames).forEach(name => {
      let base = name;
      noise.forEach(re => { base = base.replace(re, '').trim(); });
      if (base.length > 3) {
        clubBases.add(base.toUpperCase());
      }
    });

    const result = Array.from(clubBases).sort();
    fs.writeFileSync('club_bases.json', JSON.stringify(result, null, 2));
    console.log(`Saved ${result.length} club bases to club_bases.json`);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

extractClubs();
