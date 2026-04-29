// src/caption.js
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getRandomReview() {
  try {
    const reviewsPath = path.join(process.cwd(), 'reviews.json');
    const reviews = JSON.parse(fs.readFileSync(reviewsPath, 'utf8'));
    const fiveStars = reviews.filter(r => r.stars === 5);
    return fiveStars[Math.floor(Math.random() * fiveStars.length)];
  } catch {
    return null;
  }
}

async function generateCaption(listing) {
  console.log(`✍️  Generating caption for: ${listing.title}`);

  const review = getRandomReview();
  const reviewSection = review
    ? `\nA recent customer review to naturally reference or quote: "${review.text}" — ${review.author}`
    : '';

  const prompt = `You are a social media manager for TheMoonPenguinShop, a handmade Etsy shop that sells beautiful brass figural resin accessories like keychains, compact mirrors, and bag hooks. The shop has a whimsical, feminine, artsy aesthetic.

Write an engaging Instagram Reels caption for this product listing:

Title: ${listing.title}
${listing.price ? `Price: ${listing.price}` : ''}
${listing.description ? `Description: ${listing.description}` : ''}
${reviewSection}

Requirements:
- 2-4 sentences max, warm and enthusiastic tone
- ALWAYS emphasize that the item is handmade — use phrases like "handcrafted by hand", "made by hand", "one-of-a-kind handmade piece", "lovingly handcrafted" etc. This must be prominent, not an afterthought
- If a review is provided, naturally weave in a short quote or paraphrase from it (e.g. "Customers are saying..." or "One happy customer called it...")
- Do NOT include any URLs or links in the caption
- End with a natural call to action referencing the link in bio
- End with 15-20 relevant hashtags on a new line
- Hashtags should include: #themoonpenguinshop, niche product tags, aesthetic tags (#cottagecore, #darkacademia, #witchyvibes, #resinart, #handmadejewelry etc.), and shopping tags (#etsyshop, #handmade, #smallbusiness)
- Do NOT use emojis in the caption text, only in hashtags if appropriate
- Keep the caption text itself under 300 characters (not counting hashtags)

Return ONLY the caption text + hashtags, nothing else.`;

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }]
  });

  const caption = message.content[0].text.trim();
  console.log(`✅ Caption generated.`);
  return caption;
}

module.exports = { generateCaption };
