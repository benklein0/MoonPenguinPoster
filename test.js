// src/test.js
// Manual test runner — runs the full pipeline once immediately
// Usage: node src/test.js

require('dotenv').config();
const { getNewListings } = require('./rss');
const { generateCaption } = require('./caption');
const { createReel, cleanup } = require('./video');
const { uploadReel } = require('./instagram');

async function test() {
  console.log('🧪 MoonPenguinPoster — Manual Test Run\n');

  // Check env vars
  const missing = ['IG_ACCESS_TOKEN', 'IG_USER_ID', 'ANTHROPIC_API_KEY'].filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error('❌ Missing env vars:', missing.join(', '));
    console.error('   Create a .env file with these values.');
    process.exit(1);
  }

  let videoPath = null;

  try {
    console.log('Step 1: Fetching RSS feed...');
    const listings = await getNewListings(1);

    if (listings.length === 0) {
      console.log('⚠️  No new listings found in RSS feed.');
      console.log('   (All listings may already be marked as seen in data/seen.json)');
      console.log('   Delete data/seen.json to reset and re-test.');
      return;
    }

    const listing = listings[0];
    console.log('\n📦 Listing found:');
    console.log(`   Title: ${listing.title}`);
    console.log(`   Price: ${listing.price}`);
    console.log(`   Image: ${listing.imageUrl}`);
    console.log(`   URL:   ${listing.listingUrl}\n`);

    if (!listing.imageUrl) {
      console.error('❌ No image URL found. Cannot create Reel.');
      return;
    }

    console.log('Step 2: Generating caption...');
    const caption = await generateCaption(listing);
    console.log('\n📝 Full caption:\n');
    console.log(caption);
    console.log('\n');

    console.log('Step 3: Creating Reel video...');
    videoPath = await createReel(listing);
    console.log(`   Video: ${videoPath}\n`);

    // Ask user if they want to actually post
    const shouldPost = process.env.SKIP_POST !== 'true';
    if (shouldPost) {
      console.log('Step 4: Uploading to Instagram...');
      await uploadReel(videoPath, caption);
      console.log('\n✅ Test complete — Reel posted successfully!');
    } else {
      console.log('Step 4: Skipped (SKIP_POST=true)');
      console.log(`\n✅ Test complete — video saved at ${videoPath}`);
      console.log('   Set SKIP_POST=false to actually post to Instagram.');
    }

  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    if (err.response) {
      console.error('API response:', JSON.stringify(err.response.data, null, 2));
    }
    process.exitCode = 1;
  } finally {
    if (videoPath && process.env.SKIP_POST !== 'true') {
      cleanup(videoPath);
    }
  }
}

test();
