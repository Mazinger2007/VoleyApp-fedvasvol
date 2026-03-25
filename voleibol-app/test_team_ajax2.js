const axios = require('axios');
const qs = require('querystring');

async function testTeamAjax2() {
  const url = 'https://fedvasvol.com/es/team/15590266';
  try {
    const { data: initialHtml, headers } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const csrfMatch = initialHtml.match(/name="csrf_token"\s+value="([^"]+)"/i);
    const csrf = csrfMatch ? csrfMatch[1] : null;
    const cookieHeader = (headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');

    const tabsToFetch = ['upcoming-matches', 'last-results', 'stats', 'information', 'competitions'];

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
        
        console.log(`JSON Keys:`, Object.keys(data));
        const tabHtml = data.html || data.view || data.content || '';
        const cleanText = String(tabHtml).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        console.log(cleanText.substring(0, 300));
        
      } catch (e) {
        console.error(`Failed:`, e.message);
      }
    }

  } catch (err) { }
}

testTeamAjax2();
