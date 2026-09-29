const https = require('https');
const fs = require('fs');

const surahs = {
  'Al-Fatiha': 1,
  'Al-Baqara': 2,
  'Al-Imran': 3,
  'An-Nisa': 4,
  Yasin: 36,
  'Ar-Rahman': 55,
  'Al-Mulk': 67,
  'An-Nas': 114,
};

const out = {};
const entries = Object.entries(surahs);
let i = 0;

function next() {
  if (i >= entries.length) {
    fs.writeFileSync('assets/data/quran-es-asad.json', `${JSON.stringify(out, null, 2)}\n`, 'utf8');
    console.log('saved', Object.keys(out).length);
    return;
  }

  const [name, num] = entries[i++];
  const url = `https://api.alquran.cloud/v1/surah/${num}/es.asad`;

  https
    .get(url, (res) => {
      let d = '';
      res.on('data', (c) => {
        d += c;
      });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error('HTTP', res.statusCode, name);
          process.exit(1);
        }

        const j = JSON.parse(d);
        if (j.code !== 200 || !j.data || !Array.isArray(j.data.ayahs)) {
          console.error('bad payload', name);
          process.exit(1);
        }

        out[name] = j.data.ayahs.map((a) => String(a.text || '').trim()).filter(Boolean);
        console.log('ok', name, out[name].length);
        next();
      });
    })
    .on('error', (e) => {
      console.error(e.message);
      process.exit(1);
    });
}

next();
