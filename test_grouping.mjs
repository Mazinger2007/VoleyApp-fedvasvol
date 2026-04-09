import { fetchChampionshipData } from './src/utils/htmlParser.js';

async function runTest() {
  const url = 'https://fedvasvol.com/es/tournament/1333207/ranking';
  console.log('Testing Improved Grouping for:', url);
  
  try {
    const data = await fetchChampionshipData(url);
    if (!data) {
      console.log('FAIL: No data returned');
      return;
    }
    
    data.mainFlow.forEach((phase, pIdx) => {
      console.log(`Phase ${pIdx}: ${phase.title}`);
      const bracket = (phase.blocks || []).find(b => b.type === 'bracket');
      if (bracket) {
        console.log('  BRACKET FOUND');
        bracket.columns.forEach((col, cIdx) => {
          console.log(`  Col ${cIdx} (${col.header}): ${col.matches.length} matches`);
          col.matches.forEach((m, mIdx) => {
            console.log(`    [${mIdx}] ${m.homeTeam} vs ${m.awayTeam} (${m.scoreText})`);
          });
        });
      }
    });

  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTest();
