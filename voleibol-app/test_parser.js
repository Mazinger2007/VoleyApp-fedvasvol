const { fetchAndParse } = require('./src/utils/htmlParser');

async function run() {
  console.log('Fetching team...');
  const blocks = await fetchAndParse('https://fedvasvol.com/es/team/15590266');
  console.log(`Found ${blocks.length} blocks`);
  
  blocks.forEach((b, i) => {
    console.log(`\nBlock ${i} [${b.type}]:`);
    if (b.type === 'table') {
      console.log('Headers:', b.headers);
      console.log('Rows count:', b.rows?.length, 'Matches count:', b.matches?.length);
      if (b.rows?.length > 0 && b.rows[0]) console.log('First Row:', b.rows[0]);
    } else {
      console.log('Content:', b.content || b.items);
    }
  });
}

run().catch(console.error);
