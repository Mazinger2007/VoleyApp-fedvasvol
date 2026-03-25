const axios = require('axios');
const qs = require('querystring');
const cheerio = require('cheerio');

async function testTeamAjax3() {
  const url = 'https://fedvasvol.com/es/team/15590266';
  try {
    const { data: initialHtml, headers } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const csrfMatch = initialHtml.match(/name="csrf_token"\s+value="([^"]+)"/i);
    const csrf = csrfMatch ? csrfMatch[1] : null;
    const cookieHeader = (headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');

    const tabsToFetch = ['stats', 'information'];

    for (const tab of tabsToFetch) {
      console.log(`\n--- TAB: ${tab} ---`);
      try {
        const { data } = await axios.post(
          'https://fedvasvol.com/es/ajax/team/15590266/change-tab',
          qs.stringify({ csrf_token: csrf, tab: tab }),
          {
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'Cookie': cookieHeader,
              'User-Agent': 'Mozilla/5.0'
            }
          }
        );
        
        const tabHtml = data.content || '';
        const $ = cheerio.load(tabHtml);
        
        // Let's see all tables
        $('table').each((i, table) => {
          console.log(`Table ${i} Headers:`, $(table).find('th, td').first().parent().text().replace(/\n/g, ' '));
          console.log(`Table ${i} Fila 1:`, $(table).find('tr').eq(1).text().replace(/\n/g, ' '));
        });
        
        // Let's see all definition lists or headings
        $('dl, ul, p.kit, h3, h4').each((i, el) => {
          console.log(`Element ${el.tagName}:`, $(el).text().trim().replace(/[\n\t]+/g, ' '));
        });

      } catch (e) {
        console.error(`Failed:`, e.message);
      }
    }

  } catch (err) { }
}

testTeamAjax3();
