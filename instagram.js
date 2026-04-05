// src/instagram.js
// Uploads and publishes Reels via Instagram Graph API

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const IG_USER_ID = process.env.IG_USER_ID;         // 34036060519375159
const ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const API_VERSION = 'v25.0';
const BASE_URL = `https://graph.instagram.com/${API_VERSION}`;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadReel(videoPath, caption) {
  console.log('📤 Uploading Reel to Instagram...');

  // Step 1: Initialize the upload container
  const initRes = await axios.post(`${BASE_URL}/${IG_USER_ID}/media`, null, {
    params: {
      media_type: 'REELS',
      video_url: null, // we'll use resumable upload
      caption,
      share_to_feed: true,
      access_token: ACCESS_TOKEN
    }
  });

  // Instagram Reels API requires a publicly accessible video URL
  // Since we're on Railway, we need to use their resumable upload endpoint instead
  // Step 1: Create upload session
  const uploadSessionRes = await axios.post(
    `https://rupload.facebook.com/video-upload/${API_VERSION}/${IG_USER_ID}/video`,
    null,
    {
      headers: {
        'Authorization': `OAuth ${ACCESS_TOKEN}`,
        'X-FB-Upload-New-Upload': 'true',
        'X-Entity-Length': fs.statSync(videoPath).size,
        'X-Entity-Name': `reel_${Date.now()}.mp4`,
        'Content-Type': 'application/octet-stream'
      }
    }
  );

  const uploadId = uploadSessionRes.data.h;

  // Step 2: Upload the video bytes
  const videoBuffer = fs.readFileSync(videoPath);
  await axios.post(
    `https://rupload.facebook.com/video-upload/${API_VERSION}/${IG_USER_ID}/video`,
    videoBuffer,
    {
      headers: {
        'Authorization': `OAuth ${ACCESS_TOKEN}`,
        'X-FB-Upload-Resume-Offset': '0',
        'Content-Type': 'application/octet-stream',
        'Upload-ID': uploadId
      }
    }
  );

  // Step 3: Create media container with the upload
  const containerRes = await axios.post(`${BASE_URL}/${IG_USER_ID}/media`, null, {
    params: {
      media_type: 'REELS',
      upload_id: uploadId,
      caption,
      share_to_feed: true,
      access_token: ACCESS_TOKEN
    }
  });

  const containerId = containerRes.data.id;
  console.log(`📦 Media container created: ${containerId}`);

  // Step 4: Poll until container is ready (can take 30-90 seconds)
  console.log('⏳ Waiting for video processing...');
  let status = 'IN_PROGRESS';
  let attempts = 0;
  while (status === 'IN_PROGRESS' && attempts < 20) {
    await sleep(10000); // wait 10 seconds between checks
    const statusRes = await axios.get(`${BASE_URL}/${containerId}`, {
      params: {
        fields: 'status_code,status',
        access_token: ACCESS_TOKEN
      }
    });
    status = statusRes.data.status_code;
    console.log(`   Status: ${status} (attempt ${attempts + 1})`);
    attempts++;
  }

  if (status !== 'FINISHED') {
    throw new Error(`Video processing failed with status: ${status}`);
  }

  // Step 5: Publish the container
  const publishRes = await axios.post(`${BASE_URL}/${IG_USER_ID}/media_publish`, null, {
    params: {
      creation_id: containerId,
      access_token: ACCESS_TOKEN
    }
  });

  console.log(`✅ Reel published! Media ID: ${publishRes.data.id}`);
  return publishRes.data.id;
}

module.exports = { uploadReel };
