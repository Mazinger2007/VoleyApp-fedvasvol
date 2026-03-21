
const axios = require('axios');

const channels = [
  { name: 'Getxo Boleibola', id: 'UCYHKUaL8kC4QDe5Cx7TgMyg' },
  { name: 'Jatorkide_BKK', id: 'UCDv0NQL_EFWtPC3i5v_Drbw' },
  { name: 'Club Voleibol Sestao', id: 'UC0RH2gitr2hjNYHhCENpzLg' },
  { name: 'Club Voleibol Madideusto', id: 'UCd2f4z5x1s1p5F3V1x7x3Yw' },
  { name: 'Navarvoley', id: 'UC_utcf6nsss9TBzw0IkTs2w' }
];

async function checkAll() {
  for (const c of channels) {
    console.log(`Checking ${c.name} (${c.id})...`);
    try {
      const res = await axios.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${c.id}`);
      console.log(`  PASSED: ${res.data.length} bytes`);
    } catch (e) {
      console.log(`  FAILED: ${e.message}`);
    }
  }
}

checkAll();
