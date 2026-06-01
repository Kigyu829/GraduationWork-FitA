/**
 * PWA 아이콘 생성 스크립트 (Canvas API 없이 SVG→PNG 변환 없이,
 * 순수 Node.js로 간단한 PNG 파일 생성)
 * 실행: node make-icons.js
 */
const fs   = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// 간단한 SVG 아이콘을 HTML로 써두고, 실제 PNG는 아래 SVG를 앱에서 사용
// PNG 생성은 canvas 모듈이 필요하므로, SVG 아이콘으로 대체
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#1a1a2e"/>
  <text x="256" y="320" text-anchor="middle" font-size="300" font-family="Segoe UI Emoji">🏃</text>
  <text x="256" y="460" text-anchor="middle" font-size="72" font-weight="bold"
        fill="white" font-family="Arial, sans-serif">FitAi</text>
</svg>`;

fs.writeFileSync(path.join(dir, 'icon.svg'), svg);

// manifest.json을 SVG 아이콘 사용으로 업데이트
const manifestPath = path.join(__dirname, 'public', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.icons = [
  { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
];
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log('✅ 아이콘 생성 완료: public/icons/icon.svg');
console.log('✅ manifest.json 업데이트 완료');
