// src/instagram.js
// Uploads video to Cloudinary for public URL, then posts as Reel via Instagram Graph API

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const IG_USER_ID = process.env.IG_USER_ID;
const ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const API_VERSION = 'v25.0';
const BASE_URL = `https://graph.instagram.com/${API_VERSION}`;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Step 1: Upload video to Cloudinary and get a public URL
async function uploadToCloudinary(videoPath) {
  console.log('☁️  Uploading video to Cloudinary...');

  const crypto = require('crypto');
  const timestamp = Math.floor(Date.now() / 1000);

  // Generate signature
  const sigStr = `timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash('sha1').update(sigStr).digest('hex');

  const form = new FormData();
  form.append('file', fs.createReadStream(videoPath));
  form.append('api_key', CLOUDINARY_API_KEY);
  form.append('timestamp', timestamp);
  form.append('signature', signature);

  const res = await axios.post(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
    form,
    { headers: form.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity, timeout: 60000 }
  );

  const publicUrl = res.data.secure_url;
  const publicId = res.data.public_id;
  console.log(`✅ Uploaded to Cloudinary: ${publicUrl}`);
  return { publicUrl, publicId };
}

// Step 2: Delete video from Cloudinary after posting (cleanup)
async function deleteFromCloudinary(publicId) {
  try {
    const crypto = require('crypto');
    const timestamp = Math.floor(Date.now() / 1000);
    const sigStr = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash('sha1').update(sigStr).digest('hex');

    await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/destroy`,
      { public_id: publicId, api_key: CLOUDINARY_API_KEY, timestamp, signature }
    );
    console.log('🗑️  Cleaned up Cloudinary upload');
  } catch (e) {
    console.warn('Cloudinary cleanup warning:', e.message);
  }
}

async function uploadReel(videoPath, caption) {
  // 1. Upload to Cloudinary to get public URL
  const { publicUrl, publicId } = await uploadToCloudinary(videoPath);

  try {
    // 2. Create Instagram media container
    console.log('📤 Creating Instagram media container...');
    const containerRes = await axios.post(`${BASE_URL}/${IG_USER_ID}/media`, null, {
      params: {
        media_type: 'REELS',
        video_url: publicUrl,
        caption,
        share_to_feed: true,
        access_token: ACCESS_TOKEN
      }
    });

    const containerId = containerRes.data.id;
    console.log(`📦 Container created: ${containerId}`);

    // 3. Poll until video is processed
    console.log('⏳ Waiting for Instagram to process video...');
    let status = 'IN_PROGRESS';
    let attempts = 0;
    while (status !== 'FINISHED' && status !== 'ERROR' && attempts < 24) {
      await sleep(10000);
      const statusRes = await axios.get(`${BASE_URL}/${containerId}`, {
        params: { fields: 'status_code', access_token: ACCESS_TOKEN }
      });
      status = statusRes.data.status_code;
      console.log(`   Status: ${status} (${attempts + 1}/24)`);
      attempts++;
    }

    if (status !== 'FINISHED') {
      throw new Error(`Video processing failed with status: ${status}`);
    }

    // 4. Publish
    console.log('🚀 Publishing Reel...');
    const publishRes = await axios.post(`${BASE_URL}/${IG_USER_ID}/media_publish`, null, {
      params: { creation_id: containerId, access_token: ACCESS_TOKEN }
    });

    console.log(`✅ Reel published! Media ID: ${publishRes.data.id}`);
    return publishRes.data.id;

  } finally {
    // Always clean up Cloudinary
    await deleteFromCloudinary(publicId);
  }
}

module.exports = { uploadReel };
