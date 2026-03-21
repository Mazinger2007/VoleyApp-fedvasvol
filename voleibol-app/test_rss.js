
const axios = require('axios');

const channelId = 'UC1L420Rk2H04xZ5_T8L_2hA'; // Getxo Boleibola

async function testRSS() {
  console.log('Testing YouTube RSS for Channel:', channelId);
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  
  try {
    const res = await axios.get(url);
    const xml = res.data;
    console.log('RSS Data Length:', xml.length);
    
    // Simple regex to find video entries
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    console.log('Found Entries:', entries.length);
    
    entries.forEach((entry, i) => {
      const title = (entry.match(/<title>(.*?)<\/title>/) || [])[1];
      const videoId = (entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/) || [])[1];
      const published = (entry.match(/<published>(.*?)<\/published>/) || [])[1];
      console.log(`${i+1}. [${published}] ${title} (ID: ${videoId})`);
    });
    
  } catch (e) {
    console.error('RSS failed:', e.message);
  }
}

testRSS();
