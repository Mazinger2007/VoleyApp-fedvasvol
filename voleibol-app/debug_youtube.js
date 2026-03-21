
const axios = require('axios');
const fs = require('fs');

// Simple .env parser since we don't want to rely on dotenv package
const envContent = fs.readFileSync('.env', 'utf8');
const apiKeyMatch = envContent.match(/EXPO_PUBLIC_YOUTUBE_API_KEY=(.*)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : null;

const channelId = 'UC1L420Rk2H04xZ5_T8L_2hA'; // Getxo Boleibola

async function testSearch() {
  console.log('Testing YouTube Search with API Key:', apiKey ? 'FOUND' : 'MISSING');
  if (!apiKey) return;

  const matchDate = new Date('2026-03-07T18:00:00Z');
  const apiStart = new Date(matchDate.getTime() - (24 * 60 * 60 * 1000)).toISOString();
  const apiEnd = new Date(matchDate.getTime() + (24 * 60 * 60 * 1000)).toISOString();

  console.log('\n--- Test 1: Exact Date Range (+/- 1 day) ---');
  try {
    const res1 = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        channelId: channelId,
        maxResults: 20,
        order: 'date',
        type: 'video',
        publishedAfter: apiStart,
        publishedBefore: apiEnd,
        key: apiKey
      }
    });
    console.log('Results:', res1.data.items.length);
    res1.data.items.forEach(item => console.log(`- ${item.snippet.title} (${item.snippet.publishedAt})` ));
  } catch (e) {
    console.error('Test 1 failed:', e.response?.data || e.message);
  }

  console.log('\n--- Test 2: Latest 50 Videos (No Date Filter) ---');
  try {
    const res2 = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        channelId: channelId,
        maxResults: 50,
        order: 'date',
        type: 'video',
        key: apiKey
      }
    });
    console.log('Results:', res2.data.items.length);
    res2.data.items.forEach(item => {
        if (item.snippet.title.includes('Madi') || item.id.videoId === 'Uy5-iWaphWo') {
            console.log(`[FOUND IT!] - ${item.snippet.title} (${item.snippet.publishedAt}) ID: ${item.id.videoId}`);
        } else {
            console.log(`- ${item.snippet.title} (${item.snippet.publishedAt})`);
        }
    });
  } catch (e) {
    console.error('Test 2 failed:', e.response?.data || e.message);
  }

  console.log('\n--- Test 3: PlaylistItems (Uploads Playlist UU...) ---');
  try {
    const playlistId = 'UU1L420Rk2H04xZ5_T8L_2hA'; // uploads playlist
    const res3 = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
      params: {
        part: 'snippet',
        playlistId: playlistId,
        maxResults: 50,
        key: apiKey
      }
    });
    console.log('Results:', res3.data.items.length);
    res3.data.items.forEach(item => {
        const pubAt = item.snippet.publishedAt;
        console.log(`- ${item.snippet.title} (${pubAt})`);
    });
  } catch (e) {
    console.error('Test 3 failed:', e.response?.data || e.message);
  }
}

testSearch();
