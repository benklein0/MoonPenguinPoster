// src/video.js
const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = './tmp';
const MUSIC_DIR = './';
const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const VIDEO_DURATION = 10;
const MUSIC_VOLUME = 0.3;

function ensureDirs() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function getRandomTrack() {
  const tracks = fs.readdirSync(MUSIC_DIR).filter(f => f.match(/^\d+\.mp3$/));
  if (tracks.length === 0) throw new Error('No mp3 tracks found in root directory');
  const pick = tracks[Math.floor(Math.random() * tracks.length)];
  console.log(`🎵 Selected track: ${pick}`);
  return path.join(MUSIC_DIR, pick);
}

async function downloadImage(url, destPath) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  fs.writeFileSync(destPath, response.data);
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Wrap long title into multiple lines
function wrapTitle(title, maxCharsPerLine = 28) {
  const words = title.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    if ((current + ' ' + word).trim().length <= maxCharsPerLine) {
      current = (current + ' ' + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
    if (lines.length >= 3) break; // max 3 lines
  }
  if (current && lines.length < 3) lines.push(current);

  return lines;
}

async function composeFrame(imagePath, listing) {
  const framePath = path.join(OUTPUT_DIR, 'frame.png');
  const imageHeight = 1350;
  const resizedImagePath = path.join(OUTPUT_DIR, 'resized.png');

  await sharp(imagePath)
    .resize(VIDEO_WIDTH, imageHeight, { fit: 'cover', position: 'centre' })
    .toFile(resizedImagePath);

  const titleLines = wrapTitle(listing.title, 26);
  const price = listing.price || '';
  const lineHeight = 68;
  const titleStartY = VIDEO_HEIGHT - 340 - (titleLines.length - 1) * lineHeight;

  const titleSvgLines = titleLines.map((line, i) =>
    `<text x="${VIDEO_WIDTH / 2}" y="${titleStartY + i * lineHeight}"
      font-family="Georgia, serif" font-size="58" fill="white"
      text-anchor="middle" font-weight="bold">${escapeXml(line)}</text>`
  ).join('\n');

  const svg = `
<svg width="${VIDEO_WIDTH}" height="${VIDEO_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bottomGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:black;stop-opacity:0"/>
      <stop offset="100%" style="stop-color:black;stop-opacity:0.88"/>
    </linearGradient>
    <linearGradient id="topGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:black;stop-opacity:0.55"/>
      <stop offset="100%" style="stop-color:black;stop-opacity:0"/>
    </linearGradient>
  </defs>

  <!-- Top gradient -->
  <rect x="0" y="0" width="${VIDEO_WIDTH}" height="200" fill="url(#topGrad)"/>

  <!-- Bottom gradient -->
  <rect x="0" y="${VIDEO_HEIGHT - 650}" width="${VIDEO_WIDTH}" height="650" fill="url(#bottomGrad)"/>

  <!-- Shop name at top -->
  <text x="${VIDEO_WIDTH / 2}" y="115"
    font-family="Georgia, serif" font-size="46" fill="white"
    text-anchor="middle" letter-spacing="5" opacity="0.95">@themoonpenguinshop</text>

  <!-- Product title (wrapped) -->
  ${titleSvgLines}

  <!-- Price pill -->
  ${price ? `
  <rect x="${VIDEO_WIDTH / 2 - 110}" y="${VIDEO_HEIGHT - 245}" width="220" height="65" rx="32" fill="white" opacity="0.92"/>
  <text x="${VIDEO_WIDTH / 2}" y="${VIDEO_HEIGHT - 200}"
    font-family="Georgia, serif" font-size="40" fill="#1a1a1a"
    text-anchor="middle" font-weight="bold">${escapeXml(price)}</text>
  ` : ''}

  <!-- CTA -->
  <text x="${VIDEO_WIDTH / 2}" y="${VIDEO_HEIGHT - 105}"
    font-family="Georgia, serif" font-size="36" fill="white"
    text-anchor="middle" opacity="0.8" letter-spacing="2">Shop via link in bio</text>
</svg>`;

  const svgBuffer = Buffer.from(svg);

  await sharp({
    create: {
      width: VIDEO_WIDTH,
      height: VIDEO_HEIGHT,
      channels: 4,
      background: { r: 245, g: 240, b: 235, alpha: 1 }
    }
  })
    .composite([
      { input: resizedImagePath, top: 0, left: 0 },
      { input: svgBuffer, top: 0, left: 0 }
    ])
    .png()
    .toFile(framePath);

  return framePath;
}

async function createReel(listing) {
  ensureDirs();
  console.log(`🎬 Composing Reel for: ${listing.title}`);

  const rawImagePath = path.join(OUTPUT_DIR, 'product_raw.jpg');
  await downloadImage(listing.imageUrl, rawImagePath);

  const framePath = await composeFrame(rawImagePath, listing);
  const musicPath = getRandomTrack();
  const outputPath = path.join(OUTPUT_DIR, `reel_${Date.now()}.mp4`);

  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(framePath)
      .inputOptions([`-loop 1`, `-t ${VIDEO_DURATION}`])
      .input(musicPath)
      .inputOptions([`-t ${VIDEO_DURATION}`])
      .outputOptions([
        '-c:v libx264',
        '-tune stillimage',
        '-c:a aac',
        '-b:a 192k',
        `-af volume=${MUSIC_VOLUME}`,
        '-pix_fmt yuv420p',
        `-vf scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}`,
        '-shortest',
        '-movflags +faststart'
      ])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  console.log(`✅ Reel created: ${outputPath}`);
  return outputPath;
}

function cleanup(videoPath) {
  try {
    const files = [videoPath, path.join(OUTPUT_DIR, 'frame.png'), path.join(OUTPUT_DIR, 'resized.png'), path.join(OUTPUT_DIR, 'product_raw.jpg')];
    files.forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });
  } catch (e) {
    console.warn('Cleanup warning:', e.message);
  }
}

module.exports = { createReel, cleanup };
