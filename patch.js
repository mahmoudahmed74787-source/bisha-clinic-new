const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
if (!fs.existsSync(htmlPath)) {
  console.error('❌ لم يتم العثور على index.html');
  process.exit(1);
}

let html = fs.readFileSync(htmlPath, 'utf-8');

if (fs.existsSync(path.join(__dirname, 'assets', 'fontawesome.css'))) {
  html = html.replace(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/[^"']+/g, 'assets/fontawesome.css');
}

if (fs.existsSync(path.join(__dirname, 'assets', 'cairo.css'))) {
  html = html.replace(/https:\/\/fonts\.googleapis\.com\/css2\?family=Cairo[^"']+/g, 'assets/cairo.css');
}

if (!html.includes('desktop-bridge.js')) {
  const lastBodyIndex = html.lastIndexOf('</body>');
  if (lastBodyIndex !== -1) {
    html = html.slice(0, lastBodyIndex) + '    <script src="desktop-bridge.js"></script>\n' + html.slice(lastBodyIndex);
  } else {
    html += '\n<script src="desktop-bridge.js"></script>\n';
  }
}

fs.writeFileSync(htmlPath, html, 'utf-8');
console.log('✅ اكتمل تعديل HTML بنجاح وأمان');
