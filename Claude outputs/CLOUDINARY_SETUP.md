# Cloudinary Integration for Belle Knits

## Overview
Images are uploaded to Cloudinary (free CDN) instead of storing them in the Postgres database. This means:
- ✅ Images load instantly from a global CDN
- ✅ No cold-start delays
- ✅ Manage images in the admin UI without rebuilding the static site
- ✅ Free tier supports 25 GB storage + 25 GB monthly bandwidth

## Setup Steps

### 1. Create a Cloudinary Account
1. Go to https://cloudinary.com
2. Sign up for free
3. In your Cloudinary dashboard, note down:
   - **Cloud Name** (Settings → Account)
   - **API Key** (Settings → Account)
   - **API Secret** (Settings → Account)

### 2. Add Cloudinary Dependencies
Update `backend/package.json` to include:
```json
"cloudinary": "^1.40.0",
"multer-storage-cloudinary": "^4.0.0"
```

Then run:
```bash
npm install
```

### 3. Set Environment Variables on Render
On the Render Web Service dashboard (`belleknits-api`), add these to environment variables:
```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

**Development:** Create a `.env` file locally (don't commit):
```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 4. Replace Backend Code
Update `backend/server.js` with the version below that uses Cloudinary.

### 5. Update Database Schema
The images are now stored as URLs, so you don't need the `files` table anymore. 

**Option A (Keep backward compatibility):** Keep the `files` table for admin-uploaded images; new products/gallery use Cloudinary URLs.

**Option B (Full migration):** Remove `files` table entirely, use only Cloudinary URLs.

The updated `server.js` below uses Cloudinary for all new uploads.

## How It Works

### Admin Uploads an Image
1. Admin goes to `/admin` and uploads an image
2. Multer receives the image
3. `multer-storage-cloudinary` sends it to Cloudinary
4. Cloudinary returns a public URL (e.g., `https://res.cloudinary.com/your-cloud/image/upload/...`)
5. Backend stores this URL in the database
6. Frontend fetches the product/gallery data and gets the Cloudinary URL
7. Image loads instantly from the global CDN ✅

### Cold-Start Performance
- Static site loads immediately from Render CDN
- API cold-starts (30-50s)
- API returns product/gallery data with **Cloudinary URLs**
- Images load instantly because they're on Cloudinary's CDN, not waiting for the backend

## Database Changes

If using the new schema (cloudinary only), you can drop the old `files` table:
```sql
DROP TABLE files;
```

The `image` column on `products` and `gallery` tables now contains Cloudinary URLs instead of `/uploads/...` paths.

## File Cleanup
Old images stored in Postgres won't automatically migrate. You have two options:

1. **Manual upload:** Re-upload them through the admin UI (they'll go to Cloudinary)
2. **Keep old images:** Don't drop the `files` table; the backend still serves old images at `/uploads/:id`

## Testing Locally
1. Create `.env` with Cloudinary credentials
2. `npm install`
3. `npm run dev`
4. Upload an image through `http://localhost:3000/admin`
5. Check the admin UI — you should see a public Cloudinary URL

## Production Deployment
1. Push your changes to GitHub
2. Add the three Cloudinary env vars to Render dashboard
3. Render auto-deploys
4. Done! Images now upload to Cloudinary automatically

## Rollback
If you need to revert:
1. Keep your old `server.js` backup
2. Restore it
3. Images uploaded to Cloudinary will still work (the URLs are valid forever)
4. Old Postgres images will still serve at `/uploads/:id`
