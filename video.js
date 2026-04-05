// src/video.js
// Composes a 9:16 Reel from product image + text overlay + random background music

const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = './tmp';
const MUSIC_DIR = './'; // mp3s are in repo root
const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const VIDEO_DURATION = 10; // seconds
const MUSIC_VOLUME = 0.3; // 30% volume so it's subtle

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

async function composeFrame(imagePath, listing) {
  const framePath = path.join(OUTPUT_DIR, 'frame.png');

  // Resize/crop image to fill the top portion of the frame (leaving room for text at bottom)
  const imageHeight = 1300;
  const resizedImagePath = path.join(OUTPUT_DIR, 'resized.png');

  await sharp(imagePath)
    .resize(VIDEO_WIDTH, imageHeight, { fit: 'cover', position: 'centre' })
    .toFile(resizedImagePath);

  // Build SVG overlay with text
  const title = listing.title.length > 50
    ? listing.title.substring(0, 47) + '...'
    : listing.title;

  const price = listing.price || '';

  const svg = `
<svg width="${VIDEO_WIDTH}" height="${VIDEO_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <!-- Dark gradient at bottom for text readability -->
  <defs>
    <linearGradient id="bottomGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:black;stop-opacity:0"/>
      <stop offset="100%" style="stop-color:black;stop-opacity:0.85"/>
    </linearGradient>
    <linearGradient id="topGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:black;stop-opacity:0.5"/>
      <stop offset="100%" style="stop-color:black;stop-opacity:0"/>
    </linearGradient>
  </defs>

  <!-- Top gradient bar -->
  <rect x="0" y="0" width="${VIDEO_WIDTH}" height="180" fill="url(#topGrad)"/>

  <!-- Bottom gradient bar -->
  <rect x="0" y="${VIDEO_HEIGHT - 620}" width="${VIDEO_WIDTH}" height="620" fill="url(#bottomGrad)"/>

  <!-- Shop name at top -->
  <text
    x="${VIDEO_WIDTH / 2}"
    y="110"
    font-family="Georgia, serif"
    font-size="48"
    fill="white"
    text-anchor="middle"
    letter-spacing="6"
    opacity="0.95"
  >@themoonpenguinshop</text>

  <!-- Product title -->
  <text
    x="${VIDEO_WIDTH / 2}"
    y="${VIDEO_HEIGHT - 280}"
    font-family="Georgia, serif"
    font-size="52"
    fill="white"
    text-anchor="middle"
    font-weight="bold"
  >${escapeXml(title)}</text>

  <!-- Price -->
  ${price ? `
  <rect
    x="${VIDEO_WIDTH / 2 - 120}"
    y="${VIDEO_HEIGHT - 230}"
    width="240"
    height="70"
    rx="35"
    fill="white"
    opacity="0.92"
  />
  <text
    x="${VIDEO_WIDTH / 2}"
    y="${VIDEO_HEIGHT - 183}"
    font-family="Georgia, serif"
    font-size="44"
    fill="#1a1a1a"
    text-anchor="middle"
    font-weight="bold"
  >${escapeXml(price)}</text>
  ` : ''}

  <!-- Link in bio CTA -->
  <text
    x="${VIDEO_WIDTH / 2}"
    y="${VIDEO_HEIGHT - 100}"
    font-family="Georgia, serif"
    font-size="38"
    fill="white"
    text-anchor="middle"
    opacity="0.8"
    letter-spacing="2"
  >Shop via link in bio</text>
</svg>`;

  // Composite: white background + product image + SVG overlay
  const svgBuffer = Buffer.from(svg);

  await sharp({
    create: {
      width: VIDEO_WIDTH,
      height: VIDEO_HEIGHT,
      channels: 4,
      background: { r: 245, g: 240, b: 235, alpha: 1 } // warm off-white background
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

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function createReel(listing) {
  ensureDirs();
  console.log(`🎬 Composing Reel for: ${listing.title}`);

  // Download product image
  const rawImagePath = path.join(OUTPUT_DIR, 'product_raw.jpg');
  await downloadImage(listing.imageUrl, rawImagePath);

  // Compose the frame
  const framePath = await composeFrame(rawImagePath, listing);

  // Get random music track
  const musicPath = getRandomTrack();

  // Output video path
  const outputPath = path.join(OUTPUT_DIR, `reel_${Date.now()}.mp4`);

  // Use ffmpeg to create video from static frame + music
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
    const files = [
      videoPath,
      path.join(OUTPUT_DIR, 'frame.png'),
      path.join(OUTPUT_DIR, 'resized.png'),
      path.join(OUTPUT_DIR, 'product_raw.jpg')
    ];
    files.forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });
  } catch (e) {
    console.warn('Cleanup warning:', e.message);
  }
}

module.exports = { createReel, cleanup };
