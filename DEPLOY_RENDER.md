# Deploy on Render

This project is ready for Render using the included `render.yaml` blueprint.

## 1) Push code to GitHub

Render deploys from your Git repository.

## 2) Create Web Service from Blueprint

In Render:

- New `+` → **Blueprint**
- Select your repository
- Render auto-detects `render.yaml`

It will create one Node web service with:

- Build command: `npm ci`
- Start command: `npm start`
- Health check: `/api/health`

## 3) Set required environment variables

In Render service settings, set:

- `MONGO_URI` = your MongoDB Atlas connection string
- `JWT_SECRET` = strong random string (or keep generated value)

Optional (for push notifications):

- `FIREBASE_SERVICE_ACCOUNT_JSON` = full Firebase service account JSON as one line

Already configured in blueprint:

- `NODE_ENV=production`
- `REQUIRE_DB=true`
- `JWT_EXPIRES_IN=7d`
- `COOKIE_EXPIRES_IN_DAYS=7`

## 4) Deploy

Trigger deploy. A successful deploy should show:

- Health check passing on `/api/health`
- Logs containing `Server running on port ...`

## 5) Smoke checks

After deploy, verify:

- `GET /api/health` returns `success: true`
- Public home `/` loads
- Login page `/login` loads
- Auth/API routes work with a real DB connection

## Notes

- Because `REQUIRE_DB=true` in Render, deployment fails fast if database is not reachable.
- If Firebase env vars are not provided, app still runs; only notification sending is disabled.
