# Overberg Wool Co.

Wool, knitting equipment and hand-knitted commissions. Natural fibre yarns, tools,
finished pieces, a bespoke quote workflow and a small admin dashboard.

## Architecture

One repository, two Render services, one Neon database.

```
GitHub repository
       │
       ├──────────────────┐
       │                  │
       ▼                  ▼
Render Static Site   Render Web Service
  (/frontend)          (/backend)
       │                  │
       │                  ▼
       │            Neon PostgreSQL
       │
       └──── HTTPS API ───►
```

The browser never talks to Neon. Every database query goes through the Web Service.

| | Static Site | Web Service |
|---|---|---|
| Source | `frontend/` → `dist/` | `backend/` |
| Holds | public pages, catalogue, gallery, quote form | API, auth, database access, admin UI |
| Secrets | **none** | `DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET` |
| Sleeps on free tier | no | yes |

The admin interface is served by the **Web Service**, not the static site, so its
session cookie stays same-origin. It is at `/admin` on the API host. Hiding that
URL is not the security — every privileged endpoint checks the session.

## Repository layout

```
.
├── frontend/                 # Render Static Site — no secrets, ever
│   ├── index.html            # home
│   ├── shop.html             # catalogue, filterable
│   ├── gallery.html          # past work
│   ├── bespoke.html          # commission quote form
│   ├── about.html            # about, shipping, returns
│   ├── 404.html
│   └── assets/
│       ├── css/styles.css    # mobile-first; phone is the base, desktop the adaptation
│       └── js/
│           ├── config.js     # THE ONLY PLACE AN API URL IS DEFINED
│           ├── api.js        # fetch wrapper; never throws a technical error at a customer
│           ├── sample-data.js# placeholder catalogue, dropped from production builds
│           └── main.js       # rendering and form handling
├── backend/                  # Render Web Service
│   ├── server.js             # API, auth, CORS, validation
│   ├── db.js                 # Neon pool, schema, seed data
│   ├── admin/index.html      # admin dashboard, served same-origin
│   └── package.json
├── build-static.sh           # frontend/ → dist/ for the static site
├── render.yaml               # both services, as a Blueprint
├── .env.example
└── .github/workflows/keepalive.yml
```

## Local development

**Backend**

```bash
cd backend
npm install
cp ../.env.example .env      # then fill in DATABASE_URL and ADMIN_PASSWORD
npm run dev                  # http://localhost:3000
```

`db.js` creates the tables and seeds the opening catalogue on first connection,
so a fresh Neon branch needs no migration step.

**Frontend**

```bash
cd frontend
python3 -m http.server 8080  # http://localhost:8080
```

`config.js` points at `http://localhost:3000` automatically when the page is
served from localhost. With the backend down the pages still load and fall back
to the placeholder catalogue — that is deliberate, not a bug.

## Deploying to Render

1. **Neon** — create a project, copy the connection string.
2. **Render → Blueprints → New Blueprint Instance**, pointing at this repo.
   `render.yaml` creates both services.
3. On the **Web Service** (`overberg-wool`) set:
   - `DATABASE_URL` — the Neon connection string
   - `ADMIN_PASSWORD` — a long password
   - `ADMIN_JWT_SECRET` — Render generates this
4. On the **Static Site** (`overberg-wool-site`) set:
   - `API_HOST` — the Web Service's URL, e.g. `https://overberg-wool.onrender.com`
5. Back on the **Web Service**, set `STATIC_SITE_ORIGINS` to the static site's
   URL (comma-separated if you also have a custom domain).
6. Redeploy both.

**Do steps 4 and 5 before sending anyone to the site.** Until then the static
site's API requests are refused by CORS and the catalogue will fall back to
placeholder data.

## Free-tier behaviour

The Web Service sleeps after 15 minutes idle and takes about 30 seconds to wake.
The site is built so that costs nothing visible:

- every page, stylesheet and asset loads with the backend down
- the catalogue and gallery fall back rather than rendering an empty page
- a failed quote submission shows *"We're temporarily unable to process your
  request…"* with a WhatsApp link
- server, database and CORS errors go to the logs, never to the customer

`.github/workflows/keepalive.yml` pings `/api/health` every 14 minutes during
trading hours. Set the `API_URL` repository variable to enable it.

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | — | liveness, used by the keepalive |
| GET | `/api/products` | — | catalogue; `?category=wool\|equipment\|finished` |
| GET | `/api/products/:slug` | — | one product |
| GET | `/api/gallery` | — | gallery entries |
| GET | `/api/settings` | — | business details |
| POST | `/api/quotes` | — | submit a commission enquiry |
| GET | `/api/quotes/:ref` | — | status of one quote by reference |
| POST | `/api/orders` | — | place an order (**priced server-side**) |
| GET | `/uploads/:id` | — | an uploaded image |
| POST | `/api/admin/login` | — | rate-limited, sets the session cookie |
| GET/PATCH/POST/DELETE | `/api/admin/*` | session | quotes, orders, products, gallery, settings |

Order totals are recalculated from the database. Prices sent by the browser are
ignored.

## Security notes

- `DATABASE_URL` exists only in the Web Service's environment. It is not in the
  repository, not in `frontend/`, and not in any built asset.
- CORS allows only the origins in `STATIC_SITE_ORIGINS`, plus localhost for
  development. Never `*`.
- The admin session is a signed JWT in an `httpOnly`, `sameSite=lax`, `secure`
  cookie, valid 12 hours. Login is rate-limited to 10 attempts per IP per 15
  minutes and the password comparison is constant-time.
- Uploaded images are stored in Postgres, not on disk — Render's filesystem is
  ephemeral and anything written to it disappears on the next deploy.
- Deleting a product deactivates it rather than removing the row, so historical
  orders keep their line items.

## Still to do

- Replace the CSS gradient placeholders with real photography.
- Confirm the real product range and prices — the seed catalogue is a first draft.
- Set the real WhatsApp number and email in `frontend/assets/js/config.js`.
- Check that `overbergwool.co.za` is available before committing to the name.
