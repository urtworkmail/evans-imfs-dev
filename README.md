# Evans Golf — Inventory & Forecasting Platform (IMFS)

Full-stack platform: Django REST API + PostgreSQL + React 19 + Nginx, fully containerised.

---

## Quick Start — Local (One Command)

```bash
# 1. Unzip and enter project
unzip evansimfs-platform.zip && cd greenway

# 2. Start everything
docker compose up --build
```

**That's it.** Open → **http://localhost:8080**

> ℹ️ The app runs on port **8080** (not 80) to avoid conflicts with Apache/IIS/other services
> that may be installed on your machine.

### First Login

The container does **not** create any users automatically. On first run, create your admin account:

```bash
docker compose exec backend python manage.py createsuperuser
```

For local testing only, you can instead seed a small set of demo accounts covering every role
(admin, general manager, warehouse manager, viewer) with weak, well-known passwords:

```bash
docker compose exec backend python manage.py seed_data
```

**Never run `seed_data` against production** — the passwords it creates are public (they're in
this README) and only meant for exercising the role-based permission system locally.

### Load Sales Data

Sales data comes from your real Shopify and QuickBooks accounts — go to **Sales** → **↓ Fetch
Shopify** / **↓ Fetch QuickBooks**. This requires the credentials below to be set in `.env`; without
them, the fetch returns a clear "not configured" error rather than fabricating data.

```bash
# Shopify
SHOPIFY_SHOP_URL=yourshop.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx

# QuickBooks
QB_CLIENT_ID=xxxxx
QB_CLIENT_SECRET=xxxxx
QB_REALM_ID=xxxxx
QB_REFRESH_TOKEN=xxxxx
QB_ENVIRONMENT=production
```

---

## Role-Based Access

Every user has a role (persona) — `admin`, `general_manager`, `warehouse_manager`, `sales_analyst`,
or `viewer` — each mapped to a fixed set of permission keys (e.g. `products.edit`, `inventory.log`,
`reorder.order`). Permissions are enforced **server-side** on every write endpoint (products,
suppliers, inventory logs, purchase orders) — not just hidden in the UI. The frontend additionally
hides actions a user's role can't perform, so nobody sees a button that would just fail.

Manage roles and per-user permission overrides under **Settings → User Management** (admin only).

---

## Appearance

The app supports light and dark mode — toggle via the icon in the top bar (or on the login page).
The choice is remembered per browser.

---

## Common Issues & Fixes

### Problem: "Postgres not ready" loops forever
**Cause:** DB credentials mismatch or corrupted volume from a previous failed run.

```bash
# Full reset — wipes volume and rebuilds fresh
docker compose down -v
docker compose up --build
```

### Problem: Port 80 already in use (Apache/IIS default page)
**Already fixed** — the app runs on **8080**. But if 8080 is also taken:

```bash
# Change port in docker-compose.yml line:
#   ports: ["8080:80"]   →   ["9000:80"]
# Then:
docker compose up --build
# Open http://localhost:9000
```

### Problem: Backend keeps retrying Postgres
```bash
# Check what's wrong with the DB container
docker compose logs db

# Check backend logs
docker compose logs backend

# Verify all containers are running
docker compose ps
```

### Problem: `docker compose` not found
```bash
# Try the older syntax
docker-compose up --build
```

---

## Useful Commands

```bash
# Start in background (detached)
docker compose up -d --build

# Follow logs for all services
docker compose logs -f

# Follow logs for one service
docker compose logs -f backend

# Stop (data preserved)
docker compose down

# Stop AND delete all data (full reset)
docker compose down -v

# Run Django management commands
docker compose exec backend python manage.py shell
docker compose exec backend python manage.py createsuperuser

# Access PostgreSQL directly
docker compose exec db psql -U greenway -d greenway_db

# Rebuild only one service (faster after code changes)
docker compose up -d --build backend
```

---

## Project Structure

```
greenway/
├── backend/
│   ├── greenway/          # Django settings, URLs, WSGI
│   ├── users/              # Custom User model, JWT auth, permission enforcement
│   ├── products/           # Products, Suppliers, Categories
│   ├── inventory/          # FabricStock, FinishedGoods, immutable audit logs
│   ├── sales/               # Orders + live Shopify/QuickBooks integrations
│   ├── forecasting/        # Demand forecast + reorder alerts
│   ├── settings_app/       # Fetch schedule, system parameters
│   ├── Dockerfile
│   └── entrypoint.sh       # Wait for DB → migrate → gunicorn
├── frontend/
│   ├── src/
│   │   ├── api/client.js   # Axios API client (all endpoints)
│   │   ├── components/     # UI.jsx (shared), Sidebar.jsx, ThemeToggle.jsx
│   │   ├── context/        # AuthContext (JWT, permissions), ThemeContext (dark/light)
│   │   ├── pages/          # Dashboard, Inventory, Sales, Forecast…
│   │   └── utils/fmt.js    # Money/number formatting helpers
│   ├── nginx.conf          # Nginx inside frontend container
│   └── Dockerfile          # Multi-stage: node build → nginx serve
├── nginx/prod.conf         # Production SSL Nginx config
├── scripts/
│   ├── backup-db.sh        # pg_dump → gzipped backup
│   └── restore-db.sh       # Restore from backup file
├── docker-compose.yml         # LOCAL — safe defaults, overridable via .env
├── docker-compose.prod.yml    # VPS — external volume + SSL
└── .env.example                # Production env template
```

---

## Database Persistence

PostgreSQL data lives in a **Docker named volume** (`greenway_postgres_data`).

| Action | Data safe? |
|---|---|
| `docker compose down` | ✅ Yes — volume kept |
| `docker compose restart` | ✅ Yes |
| Machine reboot | ✅ Yes |
| `docker compose down -v` | ❌ No — explicitly deletes volumes |
| `docker volume rm greenway_postgres_data` | ❌ No |

---

## VPS Production Deployment

### Architecture

```
Internet → [Nginx reverse proxy: 80/443 + SSL]
                    ↓              ↓
           [frontend:nginx]  [backend:gunicorn]
                                   ↓
                         [PostgreSQL container]
                                   ↓
                    [External Docker named volume]
                     /var/lib/docker/volumes/
                     greenway_postgres_data/_data/
```

**Why PostgreSQL in Docker with external volume (not managed DB)?**
- Volume data lives on the host at `/var/lib/docker/volumes/` — fully persistent
- Survives all container rebuilds, restarts, and `docker compose down`
- Only deleted by explicit `docker volume rm` — can't happen by accident
- Easy `pg_dump` backups via the included script
- Free — no managed DB fees for a small business deployment

**Upgrade to managed DB (RDS/Supabase) when:** team grows, you need point-in-time recovery, or uptime SLA > 99.9%.

---

### VPS Setup — Step by Step

#### 1. Provision VPS
- Ubuntu 22.04+ LTS, minimum 2 vCPU / 2 GB RAM / 20 GB SSD (a small root volume will fill up fast
  once you're building images regularly — 20GB+ is a practical minimum, not just a floor)
- Open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS)

#### 2. Install Docker

```bash
ssh root@YOUR_SERVER_IP
curl -fsSL https://get.docker.com | sh
systemctl enable docker
docker --version && docker compose version
```

#### 3. Set up firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

#### 4. Clone and configure

```bash
mkdir -p /opt/evansimfs && cd /opt/evansimfs
git clone <your-repository-url> .

# Create production .env
cp .env.example .env
nano .env
```

Fill in your `.env`:
```bash
SECRET_KEY=$(openssl rand -base64 50 | tr -d '\n')   # paste output here — must be a single line
DEBUG=False
DB_PASSWORD=YourStrongPassword123!
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com,backend
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
GUNICORN_WORKERS=5
# Plus SHOPIFY_* and QB_* credentials — see "Load Sales Data" above
```

#### 5. Update domain in Nginx config

```bash
sed -i 's/YOUR_DOMAIN.COM/yourdomain.com/g' nginx/prod.conf
```

#### 6. Create the external persistent volume (ONCE)

```bash
# This volume survives everything except explicit rm
docker volume create greenway_postgres_data
```

#### 7. Get SSL certificate

```bash
# Start services (HTTP only first, for ACME challenge)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d db backend frontend

# Get certificate from Let's Encrypt
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm certbot \
  certbot certonly --webroot \
  --webroot-path /var/www/certbot \
  --email you@yourdomain.com \
  --agree-tos --no-eff-email \
  -d yourdomain.com -d www.yourdomain.com
```

#### 8. Start full production stack

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

#### 9. Verify

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
# All containers should show "Up" (db, backend, celery, celery-beat, frontend, nginx-proxy, redis)

curl -I https://yourdomain.com
# Should return HTTP/2 200
```

#### 10. Backups

Backups are **event-driven, not on a schedule**: every time a Shopify/QuickBooks fetch actually
creates new orders (whether triggered by clicking "Fetch" in the UI or by the scheduled Celery
task), the app runs `pg_dump` itself right after and keeps only the **4 most recent** backups —
see `backend/settings_app/backup.py`. Files land in `/opt/evansimfs/backups` (mounted into the
`backend`/`celery` containers at `/app/backups`).

There's no cron job to set up. If you want a manual backup on demand (e.g. right before a risky
deploy), run:

```bash
./scripts/backup-db.sh
```

That uses the exact same code path (and the same keep-last-4 retention) as the automatic backups.

---

### Production Management

```bash
cd /opt/evansimfs
alias prod="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

prod ps                                    # Status
prod logs -f backend                       # Backend logs
prod exec backend python manage.py shell   # Django shell
prod exec db psql -U greenway -d greenway_db  # DB access
prod up -d --build backend celery celery-beat frontend  # Deploy update
prod down                                  # Stop (data safe)

# Backup now
./scripts/backup-db.sh

# Restore from backup
./scripts/restore-db.sh backups/greenway_20260101_020000.sql.gz

# Renew SSL
prod run --rm certbot certbot renew
prod exec nginx-proxy nginx -s reload
```

---

### Deploying Updates

```bash
cd /opt/evansimfs
git pull origin main

# Rebuild and restart — migrations run automatically, DB untouched
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build backend celery celery-beat frontend

# If backend/celery/celery-beat were rebuilt, nginx-proxy needs a restart too —
# it caches the backend container's IP and won't notice the new one otherwise.
docker restart evansimfs-nginx-proxy-1
```

---

## Environment Variables Reference

| Variable | Local default | Description |
|---|---|---|
| `SECRET_KEY` | dev-only default | Django secret — use `openssl rand -base64 50 \| tr -d '\n'` for prod (must be a single line) |
| `DEBUG` | `True` | Always `False` in production |
| `DB_NAME` | `greenway_db` | PostgreSQL database name |
| `DB_USER` | `greenway` | PostgreSQL username |
| `DB_PASSWORD` | dev-only default | PostgreSQL password — change for prod |
| `DB_HOST` | `db` | Docker service name — don't change |
| `ALLOWED_HOSTS` | `localhost,…` | Comma-separated Django allowed hosts |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:8080` | Comma-separated CORS origins |
| `GUNICORN_WORKERS` | `2` | Workers = 2×CPUs+1 |
| `SHOPIFY_SHOP_URL` / `SHOPIFY_ACCESS_TOKEN` | — | Required for the Sales page's Shopify fetch to work |
| `QB_CLIENT_ID` / `QB_CLIENT_SECRET` / `QB_REALM_ID` / `QB_REFRESH_TOKEN` | — | Required for the QuickBooks fetch to work |

> Changing `DB_PASSWORD` on an existing deployment does **not** change the actual Postgres role
> password — Postgres only applies it on first init. To rotate it later, run `ALTER ROLE greenway
> WITH PASSWORD '...'` inside the `db` container, then update `.env` to match.

---

## Production Security Checklist

- [ ] `SECRET_KEY` is a unique random 50+ char string, set via `.env` (not the code default)
- [ ] `DEBUG=False`
- [ ] `DB_PASSWORD` is strong (16+ chars) and matches the actual Postgres role password
- [ ] HTTPS working (`curl -I https://yourdomain.com`)
- [ ] UFW firewall enabled (only 22, 80, 443 open)
- [ ] SSH password auth disabled (key-only)
- [ ] Backups appearing after a real fetch and verified non-empty (`ls -lh /opt/evansimfs/backups`)
- [ ] Default `admin` password changed after first login
- [ ] `seed_data` has never been run against this environment
