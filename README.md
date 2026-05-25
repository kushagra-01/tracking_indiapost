# India Post Tracking (Node/Express)

Small production-style API that wraps India Post **Bulk Tracking API**.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env`:

```bash
cp .env.example .env
```

3. Put your India Post portal credentials in `.env`:

- `INDIAPOST_USERNAME`
- `INDIAPOST_PASSWORD`
- If login fails, confirm these are the **Customer Self-Service Portal** credentials from India Post.

## Run

Dev (auto-reload):

```bash
npm run dev
```

If port `3000` is already in use, run on another port:

```bash
PORT=3100 npm start
```

Prod:

```bash
npm start
```

## API

### `POST /track`

Request:

```json
{
  "consignments": ["QM125388411IN"]
}
```

Response (normalized):

```json
{
  "success": true,
  "data": {
    "upstream_message": "data retrieved successfully",
    "count": 1,
    "items": [
      {
        "consignment": "QM125388411IN",
        "status": "delivered",
        "last_event": {
          "date": "2025-08-13T00:00:00Z",
          "time": "15:31:52",
          "office": "Vijayanagar S.O (Bengaluru)",
          "event": "Item Delivered"
        },
        "booking_details": { "...": "..." },
        "tracking_details": [{ "...": "..." }]
      }
    ]
  }
}
```

### `GET /health`

Simple liveness check.

## Deploy backend on Render

1. Push this repo to GitHub/GitLab.
2. In [Render](https://dashboard.render.com/) → **New** → **Blueprint** (or **Web Service**).
3. Connect the repo. If using **Blueprint**, Render reads `render.yaml` at the repo root.
4. Set **secret** environment variables in the Render dashboard (not in git):

   | Variable | Required |
   |----------|----------|
   | `INDIAPOST_USERNAME` | Yes |
   | `INDIAPOST_PASSWORD` | Yes |
   | `JWT_SECRET` | Yes (long random string) |
   | `MONGODB_URI` | Yes for share links ([MongoDB Atlas](https://www.mongodb.com/atlas) free tier) |
   | `SUPERADMIN_USERNAME` | Recommended |
   | `SUPERADMIN_PASSWORD` | Recommended |

5. After deploy, open `https://YOUR-SERVICE.onrender.com/health` — should return `{ "success": true, "data": { "status": "ok", ... } } }`.
6. Point the React app at the API (build-time):

   ```bash
   # client/.env.production
   VITE_API_BASE_URL=https://YOUR-SERVICE.onrender.com
   ```

**Notes**

- Free tier sleeps after inactivity; first request may be slow.
- Full ZIP export jobs need a long-running instance (Starter plan or higher is more reliable than Free for large batches).
- `render.yaml` sets `TRUST_PROXY=1` and `healthCheckPath: /health`.

## Notes

- India Post token is obtained from:
  - Login: `https://app.indiapost.gov.in/beextcustomer/v1/access/login`
  - Refresh: `https://app.indiapost.gov.in/beextcustomer/v1/access/TokenWithRtoken`
- Tracking is fetched from:
  - `https://app.indiapost.gov.in/beextcustomer/v1/tracking/bulk`
- Service validates up to 50 consignments per call (per doc).

