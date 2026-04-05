// src/rss.js
// Fetches and parses the Etsy RSS feed for TheMoonPenguinShop

const RSSParser = require('rss-parser');
const parser = new RSSParser({
  customFields: {
    item: ['media:content', 'media:thumbnail', 'g:price']
  }
});

const FEED_URL = 'https://www.etsy.com/shop/TheMoonPenguinShop/rss';
const SEEN_FILE = './data/seen.json';
const fs = require('fs');
const path = require('path');

function loadSeen() {
  try {
    if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
    if (!fs.existsSync(SEEN_FILE)) return [];
    return JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveSeen(seen) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2));
}

async function getNewListings(maxNew = 3) {
  console.log('📡 Fetching Etsy RSS feed...');
  const feed = await parser.parseURL(FEED_URL);
  const seen = loadSeen();

  const newItems = feed.items.filter(item => !seen.includes(item.guid || item.link));

  if (newItems.length === 0) {
    console.log('No new listings found.');
    return [];
  }

  // Take up to maxNew listings
  const toProcess = newItems.slice(0, maxNew);

  // Extract clean data from each listing
  const listings = toProcess.map(item => {
    // Try to get image from multiple possible RSS fields
    let imageUrl = null;
    if (item['media:content'] && item['media:content']['$'] && item['media:content']['$'].url) {
      imageUrl = item['media:content']['$'].url;
    } else if (item['media:thumbnail'] && item['media:thumbnail']['$'] && item['media:thumbnail']['$'].url) {
      imageUrl = item['media:thumbnail']['$'].url;
    } else if (item.enclosure && item.enclosure.url) {
      imageUrl = item.enclosure.url;
    }

    // Try to extract price from description or title
    let price = null;
    const priceMatch = (item.content || item.contentSnippet || '').match(/\$[\d,]+\.?\d*/);
    if (priceMatch) price = priceMatch[0];

    // Clean up title
    const title = item.title ? item.title.replace(/^\s+|\s+$/g, '') : 'New Item';

    return {
      id: item.guid || item.link,
      title,
      price,
      imageUrl,
      listingUrl: item.link,
      description: item.contentSnippet || ''
    };
  });

  // Mark all new items as seen (not just the ones we process, to avoid re-processing later)
  const allNewIds = newItems.map(item => item.guid || item.link);
  saveSeen([...seen, ...allNewIds].slice(-500)); // Keep last 500 to avoid file bloat

  console.log(`✅ Found ${listings.length} new listing(s) to process.`);
  return listings;
}

module.exports = { getNewListings };
