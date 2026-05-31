/**
 * Server-side 이미지 합성 — 브라우저 프레임 + sunset 배경 그라데이션.
 *
 * components/editor/image-annotator/canvas.tsx의 'browser' frame + 'sunset'
 * BgColor 디자인을 sharp + SVG로 재현. 어드민 도구의 export 결과와 시각적
 * 동등.
 *
 * 입력: 원본 이미지 Buffer (PNG/JPG/WebP)
 * 출력: 합성된 PNG Buffer (sunset 그라데이션 배경 + 브라우저 chrome + 원본)
 */
import sharp from 'sharp';

// canvas.tsx와 동일한 상수
const BROWSER_PAD = 16;
const BROWSER_BAR_HEIGHT = 36;
// types.ts BG_GRADIENTS.sunset
const GRADIENT = ['#fed7aa', '#fbcfe8'];
// 신호등 색상 (canvas.tsx line 492-494)
const TRAFFIC = [
  { fill: '#ff5f57', stroke: '#e0443e' }, // close
  { fill: '#febc2e', stroke: '#dea123' }, // minimize
  { fill: '#28c840', stroke: '#1aab29' }, // maximize
];
const URL_BAR_TEXT = 'support.oapms.com';

/**
 * 브라우저 프레임 + sunset 배경 합성.
 *
 * @param {Buffer} imageBuffer 원본 이미지 바이트
 * @returns {Promise<Buffer>} 합성된 PNG 바이트
 */
export async function compositeBrowserFrame(imageBuffer) {
  const meta = await sharp(imageBuffer).metadata();
  const W = meta.width;
  const H = meta.height;
  if (!W || !H) throw new Error('이미지 크기 읽기 실패');

  const totalW = W + BROWSER_PAD * 2;
  const totalH = H + BROWSER_PAD * 2 + BROWSER_BAR_HEIGHT;

  // chrome의 좌상단 = (BROWSER_PAD, BROWSER_PAD)
  // toolbar 영역 y = BROWSER_PAD ~ BROWSER_PAD + BROWSER_BAR_HEIGHT
  // image 영역 y = BROWSER_PAD + BROWSER_BAR_HEIGHT ~ totalH - BROWSER_PAD
  const chromeX = BROWSER_PAD;
  const chromeY = BROWSER_PAD;
  const chromeW = W;
  const chromeH = BROWSER_BAR_HEIGHT + H;

  // URL bar (chrome 너비 > 220일 때만)
  let urlBarSvg = '';
  if (chromeW > 220) {
    const urlBarW = Math.min(420, chromeW * 0.5);
    const urlBarX = chromeX + (chromeW - urlBarW) / 2;
    const urlBarH = 20;
    const urlBarY = chromeY + (BROWSER_BAR_HEIGHT - urlBarH) / 2;
    urlBarSvg = `
      <rect x="${urlBarX}" y="${urlBarY}" width="${urlBarW}" height="${urlBarH}" rx="5" fill="#ffffff" stroke="#d4d4d8" stroke-width="0.5"/>
      <text x="${urlBarX + urlBarW / 2}" y="${urlBarY + urlBarH / 2}" font-family="-apple-system, BlinkMacSystemFont, system-ui, sans-serif" font-size="11" fill="#71717a" text-anchor="middle" dominant-baseline="central">${URL_BAR_TEXT}</text>
    `;
  }

  // 신호등 3개 위치 (chrome 안쪽 기준 x=16,34,52 / y=BROWSER_BAR_HEIGHT/2)
  const dotY = chromeY + BROWSER_BAR_HEIGHT / 2;
  const dotsSvg = TRAFFIC.map(
    (d, i) =>
      `<circle cx="${chromeX + 16 + i * 18}" cy="${dotY}" r="6" fill="${d.fill}" stroke="${d.stroke}" stroke-width="0.5"/>`,
  ).join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${totalW}" y2="${totalH}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${GRADIENT[0]}"/>
      <stop offset="1" stop-color="${GRADIENT[1]}"/>
    </linearGradient>
    <filter id="chromeShadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity="0.22"/>
    </filter>
    <clipPath id="chromeClip">
      <rect x="${chromeX}" y="${chromeY}" width="${chromeW}" height="${chromeH}" rx="10"/>
    </clipPath>
  </defs>

  <!-- 배경 그라데이션 -->
  <rect width="${totalW}" height="${totalH}" fill="url(#bg)"/>

  <!-- chrome 외곽 (그림자 + 흰 배경 + 라운드) -->
  <g filter="url(#chromeShadow)">
    <rect x="${chromeX}" y="${chromeY}" width="${chromeW}" height="${chromeH}" rx="10" fill="#ffffff"/>
  </g>

  <!-- 상단 toolbar (chrome 안쪽으로 clip) -->
  <g clip-path="url(#chromeClip)">
    <rect x="${chromeX}" y="${chromeY}" width="${chromeW}" height="${BROWSER_BAR_HEIGHT}" fill="#f1f3f5"/>
    <rect x="${chromeX}" y="${chromeY + BROWSER_BAR_HEIGHT - 1}" width="${chromeW}" height="1" fill="#e2e8f0"/>
  </g>

  <!-- 신호등 -->
  ${dotsSvg}

  <!-- URL 바 -->
  ${urlBarSvg}
</svg>`;

  // SVG를 raster화 + 원본 이미지 composite
  const result = await sharp(Buffer.from(svg))
    .composite([
      {
        input: imageBuffer,
        top: chromeY + BROWSER_BAR_HEIGHT,
        left: chromeX,
      },
    ])
    .png()
    .toBuffer();

  return result;
}
