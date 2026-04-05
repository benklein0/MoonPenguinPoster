// src/index.js
// Main entry point — runs on cron schedule, orchestrates the full pipeline

require('dotenv').config();
const cron = require('node-cron');
const { getNewListings } = require('./rss');
const { generateCaption } = require('./caption');
const { createReel, cleanup } = require('./video');
const { uploadReel } = require('./instagram');

// Validate required env vars on startup
const REQUIRED_ENV = ['IG_ACCESS_TOKEN', 'IG_USER_ID', 'ANTHROPIC_API_KEY'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// Post schedule: 10am, 2pm, 6pm EST (UTC-4 in summer / UTC-5 in winter)
// Using UTC times: 14:00, 18:00, 22:00 (EST = UTC-4 during daylight saving)
const POST_TIMES = [
  '0 14 * * *',  // 10:00 AM EST
  '0 18 * * *',  // 2:00 PM EST
  '0 22 * * *',  // 6:00 PM EST
];

async function runPipeline() {
  console.log('\n🐧 MoonPenguinPoster — Starting pipeline run');
  console.log(`⏰ ${new Date().toISOString()}`);

  let listing = null;
  let videoPath = null;

  try {
    // 1. Get one new listing from RSS feed
    const listings = await getNewListings(1);
    if (listings.length === 0) {
      console.log('💤 No new listings to post. Skipping.');
      return;
    }

    listing = listings[0];

    // Skip listings with no image
    if (!listing.imageUrl) {
      console.warn(`⚠️  Listing has no image URL, skipping: ${listing.title}`);
      return;
    }

    // 2. Generate caption
    const caption = await generateCaption(listing);
    console.log('\n📝 Caption preview:\n', caption.substring(0, 150) + '...\n');

    // 3. Create Reel video
    videoPath = await createReel(listing);

    // 4. Upload and publish to Instagram
    await uploadReel(videoPath, caption);

    console.log(`\n🎉 Successfully posted: ${listing.title}`);

  } catch (err) {
    console.error('\n❌ Pipeline error:', err.message);
    if (err.response) {
      console.error('API response:', JSON.stringify(err.response.data, null, 2));
    }
  } finally {
    // Always clean up temp files
    if (videoPath) cleanup(videoPath);
  }
}

// Schedule posts
POST_TIMES.forEach((cronTime, i) => {
  const labels = ['10:00 AM', '2:00 PM', '6:00 PM'];
  cron.schedule(cronTime, () => {
    console.log(`\n⏰ Scheduled trigger: ${labels[i]} EST`);
    runPipeline();
  }, {
    timezone: 'UTC'
  });
  console.log(`📅 Scheduled post at ${labels[i]} EST (${cronTime} UTC)`);
});

console.log('\n🐧 MoonPenguinPoster is running. Waiting for scheduled times...');
console.log('   Posts scheduled for: 10:00 AM, 2:00 PM, 6:00 PM EST\n');

// Allow manual trigger via environment variable for testing
if (process.env.RUN_NOW === 'true') {
  console.log('🚀 RUN_NOW=true detected, running pipeline immediately...');
  runPipeline();
}
