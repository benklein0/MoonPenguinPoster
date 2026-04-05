# 🐧 MoonPenguinPoster

Automatically posts TheMoonPenguinShop Etsy listings to Instagram Reels.

## How it works

1. Polls the Etsy RSS feed for new listings
2. Generates a caption + hashtags using Claude AI
3. Composes a 9:16 Reel (product image + text overlay + background music)
4. Posts to Instagram via the Graph API

Posts run at **10:00 AM, 2:00 PM, and 6:00 PM EST**, max 3 per day.

---

## Setup

### 1. Clone the repo and install dependencies

```bash
git clone https://github.com/benklein0/MoonPenguinPoster
cd MoonPenguinPoster
npm install
```

### 2. Install ffmpeg (required for video creation)

**Mac:**
```bash
brew install ffmpeg
```

**Ubuntu/Railway:** handled automatically via nixpacks

### 3. Create your .env file

```bash
cp .env.example .env
```

Fill in:
- `IG_ACCESS_TOKEN` — from Meta Graph API Explorer (MoonpenguinPoster app)
- `IG_USER_ID` — `34036060519375159`
- `ANTHROPIC_API_KEY` — from console.anthropic.com

### 4. Test locally

```bash
# Test full pipeline but skip posting
SKIP_POST=true npm test

# Test full pipeline including posting
npm test
```

### 5. Deploy to Railway

1. Go to [railway.app](https://railway.app) and create a new project
2. Connect your GitHub repo (`benklein0/MoonPenguinPoster`)
3. Add environment variables in Railway dashboard (same as .env)
4. Deploy — Railway will auto-install ffmpeg and start the cron scheduler

---

## Token renewal

The Instagram access token expires every ~60 days. When it does:
1. Go to [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer)
2. Generate a new token for MoonpenguinPoster
3. Update `IG_ACCESS_TOKEN` in Railway environment variables

---

## Music tracks

Tracks `1.mp3` through `7.mp3` in the repo root are randomly selected for each Reel.
Add more mp3 files named `8.mp3`, `9.mp3` etc. to expand the library.
