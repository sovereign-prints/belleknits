# Brief: Add Cloudinary Image Hosting to Sovereign Prints

**Purpose:** Replicate the Cloudinary setup done for Belle Knits on the
Sovereign Prints website, using the **same Cloudinary account**
(cloud name `liowbk0n`). Images uploaded through Sovereign Prints' admin
will land in the same Cloudinary account, in a separate folder, so both
sites share one free-tier quota without mixing assets.

This is a reusable brief — hand it to a future session/session-per-site
as-is. Anything marked **[CONFIRM]** must be checked against the actual
Sovereign Prints repo before proceeding, since it may differ from Belle
Knits' stack.

---

## 0. Context / why

Belle Knits had a problem: product/gallery images were stored in Postgres
and served through the backend API. On Render's free tier, the backend
spins down after inactivity, so the *first* image request after a cold
start could take 30-50 seconds — even though the static frontend loaded
instantly from Render's CDN.

Fix: images now upload to **Cloudinary** (a free CDN) instead of Postgres.
The backend stores the returned Cloudinary URL in the database and returns
it via the API as normal. The frontend renders `<img src="cloudinary-url">`
exactly as before — no frontend changes needed, no rebuild required when
images change. Because the URL is a plain HTTPS link to Cloudinary's own
CDN, the image loads instantly regardless of whether the backend is warm
or cold-starting.

This brief assumes Sovereign Prints has (or should have) a similar
architecture: a static frontend + a small backend/API + a database,
matching this workspace's mandatory architecture (see project
instructions: Static Site + Web Service + Neon, never direct DB access
from the frontend).

---

## 1. Pre-work — confirm the actual Sovereign Prints setup **[CONFIRM]**

Before touching anything, check:

- [ ] Where does Sovereign Prints currently store/serve images? (Postgres
      blob, local disk, already on a CDN, hardcoded static files?)
- [ ] Is there a Render Web Service (or equivalent backend) at all, or is
      the site fully static?
- [ ] What's the upload library in use, if any? (Likely `multer` if it's
      Node/Express, matching Belle Knits — but confirm.)
- [ ] What's the admin upload flow — is there an admin UI, and where does
      it live (same-origin on the backend, like Belle Knits' `/admin`)?
- [ ] Repo location and structure — is it `backend/` + `frontend/` like
      Belle Knits, or different?
- [ ] Which Render services exist for this site currently? (We know
      `sovereign-prints-site` exists in the same Render workspace as
      Belle Knits — confirm this is the live one, and find its paired
      backend service if any.)

Do not assume the Belle Knits code structure carries over 1:1 — read the
actual files first.

---

## 2. Cloudinary account — reuse, don't recreate

**Use the existing Cloudinary account**, cloud name `liowbk0n` (same
account already wired up for Belle Knits). Do not create a second
Cloudinary account — the free tier (25 GB storage + 25 GB/month
bandwidth) is shared across everything in one account, and one account
is simpler to manage.

Get the credentials from **https://console.cloudinary.com** → Settings
(gear icon) → API Keys:
- Cloud Name: `liowbk0n`
- API Key: (same one used for Belle Knits — retrieve from the console,
  don't hardcode a copy anywhere insecure)
- API Secret: (same — copy directly from Cloudinary's console into
  Render's environment variables; never paste it into chat, a doc, or a
  committed file)

**Folder separation:** When configuring `CloudinaryStorage`, set a
distinct `folder` param for Sovereign Prints uploads (e.g.
`folder: 'sovereign-prints'`), so its assets don't mix with Belle Knits'
`belle-knits` folder in the same account. This keeps the Media Library
organized and makes it easy to audit usage per site later.

---

## 3. Backend changes

Mirror the pattern used in Belle Knits' `backend/server.js`:

1. Add dependencies to `package.json`:
   ```json
   "cloudinary": "^1.40.0",
   "multer-storage-cloudinary": "^4.0.0"
   ```
   (`multer` itself is likely already a dependency if there's an existing
   upload flow — confirm, don't duplicate.)

2. Configure Cloudinary near the top of the server entrypoint:
   ```js
   const cloudinary = require('cloudinary').v2;
   const { CloudinaryStorage } = require('multer-storage-cloudinary');

   cloudinary.config({
     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
     api_key: process.env.CLOUDINARY_API_KEY,
     api_secret: process.env.CLOUDINARY_API_SECRET
   });

   const storage = new CloudinaryStorage({
     cloudinary: cloudinary,
     params: {
       folder: 'sovereign-prints',       // <- distinct from belle-knits
       resource_type: 'auto',
       allowed_formats: ['jpg', 'png', 'webp', 'gif']
     }
   });

   const upload = multer({
     storage: storage,
     limits: { fileSize: 8 * 1024 * 1024 },
     fileFilter: (req, file, cb) => {
       const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
       cb(allowed.includes(file.mimetype) ? null : new Error('Invalid file type'),
          allowed.includes(file.mimetype));
     }
   });
   ```

3. Replace any existing upload-handling code (e.g. `multer.memoryStorage()`
   + a manual "save to Postgres" step) with the Cloudinary-backed `upload`
   above. Wherever the code previously did something like:
   ```js
   const id = crypto.randomUUID() + ext;
   await db.query('INSERT INTO files ...', [...]);
   return `/uploads/${id}`;
   ```
   it should now just use `req.file.path` — that's the Cloudinary CDN URL,
   already public, no extra DB write needed for the file itself (only
   store the URL string on the relevant product/image record).

4. Any endpoint serving old-style `/uploads/:id` files from Postgres can
   stay in place for backward compatibility with pre-existing images
   (don't break old image links), but all *new* uploads should go through
   Cloudinary from here on.

5. Double check error handling covers Cloudinary/multer failure modes
   (invalid file type, file too large) with friendly, non-technical
   messages — matching the project's "customers never see a database or
   server error" rule.

---

## 4. Environment variables

**Locally** (`backend/.env`, never committed):
```
CLOUDINARY_CLOUD_NAME=liowbk0n
CLOUDINARY_API_KEY=<same as Belle Knits>
CLOUDINARY_API_SECRET=<same as Belle Knits>
```

**On Render** (the Sovereign Prints backend/web service, once identified
in step 1):
1. Dashboard → select the Sovereign Prints backend service → Environment
2. Add the same three `CLOUDINARY_*` variables
3. Save — Render auto-redeploys

Update `.env.example` in the Sovereign Prints repo to document the three
new placeholder variables, same as was done for Belle Knits.

---

## 5. Push and verify

1. Commit the backend changes (`server.js`/equivalent + `package.json` +
   `.env.example`), push to the Sovereign Prints GitHub repo.
2. Confirm Render's build log shows a successful `npm install` picking up
   `cloudinary` and `multer-storage-cloudinary`, and the service comes up
   healthy (check whatever health-check endpoint exists, or hit the
   service root).
3. **End-to-end test** (same method used for Belle Knits): log into the
   Sovereign Prints admin, upload one test image, then check the relevant
   public API endpoint or page to confirm the returned image URL starts
   with `https://res.cloudinary.com/liowbk0n/image/upload/.../
   sovereign-prints/...`.
4. Delete the test upload/entry afterward to keep the live site clean —
   confirm with the user before deleting anything that's gone live on the
   public site, same as before.

---

## 6. What NOT to change

- Do not touch the Belle Knits backend, its Cloudinary folder
  (`belle-knits`), or its environment variables.
- Do not create a second Cloudinary account.
- Do not convert the Sovereign Prints static frontend into a
  server-rendered app, or have the frontend talk to Neon/Postgres
  directly — same mandatory architecture constraint as Belle Knits
  (Static Site + Web Service + DB, never frontend-to-DB).
- Do not commit real Cloudinary credentials, database URLs, or admin
  passwords to the repo.

---

## 7. Open questions to resolve before starting

- Confirm Sovereign Prints' actual current image-storage method (may not
  need this fix at all if it's not experiencing the same cold-start
  image-loading problem).
- Confirm which Render service is the live "web service" backend for
  Sovereign Prints (if one exists) — `sovereign-prints-site` was seen in
  the same Render workspace as Belle Knits but was not otherwise
  inspected.
- Confirm who owns/has push access to the Sovereign Prints GitHub repo,
  and get repo name + local folder path (if any) before editing files.
