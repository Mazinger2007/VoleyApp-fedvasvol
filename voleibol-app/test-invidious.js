// c:\Users\317176K\Documents\Github\Voleibol\voleibol-app\test-invidious.js
const axios = require('axios');

const INVIDIOUS_HOSTS = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.drgns.space',
  'https://invidious.projectsegfau.lt',
  'https://invidious.perennialte.ch',
  'https://yt.artemislena.eu',
  'https://invidious.jing.rocks',
  'https://vid.puffyan.us',
  'https://iv.ggtyler.dev',
  'https://inv.tux.pizza'
];

async function checkServer(host) {
  const start = Date.now();
  try {
    // Usamos el endpoint /api/v1/stats con timeout corto (5s)
    await axios.get(`${host}/api/v1/stats`, { timeout: 10000 });
    const latency = Date.now() - start;
    return { host, status: 'OK', latency };
  } catch (error) {
    let errMsg = error.message;
    if (error.response) {
      errMsg = `Status: ${error.response.status}`;
    }
    return { host, status: 'FAIL', error: errMsg };
  }
}

async function runTest() {
  console.log('\n📡 Iniciando diagnóstico de servidores Invidious...');
  console.log('------------------------------------------------');

  const results = await Promise.all(INVIDIOUS_HOSTS.map(checkServer));

  const working = results.filter(r => r.status === 'OK').sort((a, b) => a.latency - b.latency);
  const failed = results.filter(r => r.status === 'FAIL');

  if (working.length > 0) {
    console.log('\n✅ SERVIDORES OPERATIVOS (Ordenados por velocidad):');
    working.forEach(r => {
      // Coloreamos la latencia visualmente (verde < 500ms, amarillo < 1000ms, rojo > 1000ms)
      const lat = r.latency.toString().padEnd(4);
      console.log(`   🟢 ${lat}ms  ${r.host}`);
    });
  } else {
    console.log('\n⚠️  NINGÚN SERVIDOR RESPONDE. Revisa tu conexión a internet.');
  }

  if (failed.length > 0) {
    console.log('\n❌ SERVIDORES CAÍDOS O LENTOS:');
    failed.forEach(r => {
      console.log(`   🔴 ${r.host.padEnd(30)} -> ${r.error}`);
    });
  }
  console.log('\n------------------------------------------------');
}

runTest();
