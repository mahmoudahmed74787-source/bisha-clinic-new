const https = require('https'); const fs = require('fs'); const path = require('path');
const ASSETS_DIR = path.join(__dirname, 'assets');
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
const WEBFONTS_DIR = path.join(ASSETS_DIR, 'webfonts');
if (!fs.existsSync(WEBFONTS_DIR)) fs.mkdirSync(WEBFONTS_DIR, { recursive: true });
function download(url, dest) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) return download(response.headers.location, dest).then(res).catch(rej);
      const file = fs.createWriteStream(dest); response.pipe(file);
      file.on('finish', () => { file.close(); res(); });
    }).on('error', rej);
  });
}
function fetchText(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => {
      if (r.statusCode === 301 || r.statusCode === 302) return fetchText(r.headers.location).then(res).catch(rej);
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
    }).on('error', rej);
  });
}
async function setup() {
  try {
    let faCss = await fetchText('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css');
    fs.writeFileSync(path.join(ASSETS_DIR, 'fontawesome.css'), faCss.replace(/\.\.\/webfonts\//g, 'webfonts/'));
    for (const f of ['fa-solid-900', 'fa-regular-400', 'fa-brands-400']) {
      await download(`https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/${f}.woff2`, path.join(WEBFONTS_DIR, `${f}.woff2`));
    }
  } catch (e) { console.log('FontAwesome error'); }
  try {
    let cairoCss = await fetchText('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800;900&display=swap');
    const urls = [...cairoCss.matchAll(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/g)];
    let i = 0;
    for (const u of urls) {
      const ext = u[1].includes('.woff2') ? 'woff2' : 'ttf';
      await download(u[1], path.join(WEBFONTS_DIR, `cairo-${i++}.${ext}`));
      cairoCss = cairoCss.replace(u[1], `webfonts/cairo-${i-1}.${ext}`);
    }
    fs.writeFileSync(path.join(ASSETS_DIR, 'cairo.css'), cairoCss);
  } catch (e) { console.log('Cairo error'); }
}
setup();
