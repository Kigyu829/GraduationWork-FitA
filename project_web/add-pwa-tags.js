/**
 * 모든 HTML 파일에 PWA 메타태그 일괄 삽입
 * 실행: node add-pwa-tags.js
 */
const fs   = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'public', 'pages');
const inject = `  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#1a1a2e">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`;

const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));
let count = 0;

files.forEach(file => {
  const filePath = path.join(pagesDir, file);
  let html = fs.readFileSync(filePath, 'utf8');

  if (html.includes('rel="manifest"')) {
    console.log(`⏭  이미 적용됨: ${file}`);
    return;
  }

  html = html.replace('</head>', `${inject}\n</head>`);
  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`✅ 적용: ${file}`);
  count++;
});

console.log(`\n완료: ${count}개 파일 수정됨`);
