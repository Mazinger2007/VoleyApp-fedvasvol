// /tmp/inspect_championship.js
const { fetchChampionshipData } = require('./src/utils/htmlParser');

const url = 'https://fedvasvol.com/es/tournament/1000632/ranking'; // Junior Femenino (approx)

async function test() {
  try {
    const data = await fetchChampionshipData(url);
    console.log(JSON.stringify(data, (key, value) => {
      if (key === 'blocks') return undefined; // Too verbose
      return value;
    }, 2));
    
    data.mainFlow.forEach((phase, i) => {
      console.log(`Phase ${i}: ${phase.title}`);
      const matches = (phase.blocks || []).flatMap(b => (b.columns || []).flatMap(c => c.matches || []));
      console.log(`  Matches: ${matches.length}`);
    });
  } catch (err) {
    console.error(err);
  }
}

test();
