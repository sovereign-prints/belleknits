# Implement Cloudinary Image Hosting

## Quick Summary
- Images upload to Cloudinary (free CDN)
- Images load instantly, even when backend is cold-starting
- No rebuilds of static site needed
- Admin can change images anytime

## Step-by-Step

### 1. Sign Up for Cloudinary (Free)
1. Go to https://cloudinary.com
2. Click "Sign Up"
3. Create account with your email
4. Dashboard opens → go to Settings (gear icon) → Account
5. Copy these three values:
   - **Cloud Name**
   - **API Key**
   - **API Secret**

### 2. Update Your Backend Code

**Replace** `backend/server.js` with the new `server-cloudinary.js`

**Update** `backend/package.json` with the new one that includes Cloudinary dependencies

Then run:
```bash
cd backend
npm install
```

### 3. Add Environment Variables

**Locally (in `backend/.env`):**
```
CLOUDINARY_CLOUD_NAME=your-cloud-name-here
CLOUDINARY_API_KEY=your-api-key-here
CLOUDINARY_API_SECRET=your-api-secret-here
```

**On Render Dashboard:**
1. Go to https://dashboard.render.com
2. Click on the `belleknits-api` service
3. Go to Environment
4. Add these three variables:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
5. Paste in the values from Cloudinary
6. Click "Save"

Render auto-deploys when env vars change.

### 4. Test Locally

```bash
cd backend
npm run dev
```

Then:
1. Go to http://localhost:3000/admin
2. Log in (password: `GX9VFTNbWdpfhbYW5OCqz794`)
3. Go to Gallery section
4. Upload a test image
5. Check the URL — should start with `https://res.cloudinary.com/...`
6. Go to the public site and see the image load instantly ✅

### 5. Push to GitHub

```bash
git add backend/server.js backend/package.json
git commit -m "feat: use Cloudinary for image hosting (no cold-start delays)

Images now upload to Cloudinary CDN instead of Postgres. This ensures
instant image loading from the global CDN, even when the backend is
cold-starting. No rebuilds of the static site needed.

- Add cloudinary and multer-storage-cloudinary dependencies
- Replace image storage with CloudinaryStorage
- Images return as Cloudinary CDN URLs (https://res.cloudinary.com/...)
- Admin can change images anytime without static site rebuilds
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01A9SPnwZr4J7Z5NpfCBvweA"
git push
```

Render auto-deploys.

### 6. Test in Production

1. Wait for Render to finish deploying (check the build log)
2. Go to https://belleknits-api.onrender.com/admin
3. Log in
4. Upload an image to Gallery
5. Go to https://belleknits.onrender.com and check the gallery
6. Image should load instantly ✅

## What Changed

### Images Now Flow Like This:
```
Admin UI (localhost or belleknits-api.onrender.com/admin)
    ↓
    Upload image
    ↓
Cloudinary (global CDN)
    ↓
    Returns URL like: https://res.cloudinary.com/abc123/image/upload/xyz.jpg
    ↓
Backend stores URL in Postgres
    ↓
Frontend requests /api/gallery
    ↓
Backend returns: { title: "...", image: "https://res.cloudinary.com/abc123/image/upload/xyz.jpg" }
    ↓
Frontend renders <img src="https://res.cloudinary.com/..."> 
    ↓
Browser loads from Cloudinary CDN instantly ✅
```

## Old Images

The `files` table in Postgres (old images) can stay there. They'll still serve at `/uploads/:id`.

To fully migrate old images to Cloudinary:
1. Export them from Postgres
2. Upload manually to Cloudinary
3. Update the URLs in the admin UI

Or just leave them — both systems work together.

## Troubleshooting

**"API key is invalid"** → Check you copied the key exactly (no spaces)

**Images still take 50s to load** → The backend is still waking up, but the image *will* load faster because it's from Cloudinary, not Postgres

**Upload fails** → Check Cloudinary env vars are set in Render dashboard, wait 1 min for auto-deploy to finish

**Images broken after upload** → Check the image URL starts with `https://res.cloudinary.com/`

## Free Tier Limits

Cloudinary free tier includes:
- 25 GB storage
- 25 GB/month bandwidth
- Auto-optimization and transformations

For Belle Knits (small business), this is plenty. Even if you add 100 product photos (~600KB each = 60GB), you'd need the free tier. Upgrade only if you exceed it (they'll warn you).

## Next Steps

Once this is working:
1. Re-upload your 4 existing product photos through the admin UI
2. Delete the old static image files from `frontend/assets/img/` (optional — they won't hurt)
3. You're done! Images are now managed centrally, load instantly, and require no site rebuilds.
