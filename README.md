# Greenway Golf Co. — Inventory & Forecasting Platform

Full-stack platform: Django REST API + PostgreSQL + React 19 + Nginx, fully containerised.

---

## Quick Start — Local (One Command)

```bash
# 1. Unzip and enter project
unzip greenway-platform.zip && cd greenway

# 2. Start everything
docker compose up --build
```

**That's it.** Open → **http://localhost:8080**

> ℹ️ The app runs on port **8080** (not 80) to avoid conflicts with Apache/IIS/other services
> that may be installed on your machine.

### Default Logins

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Full admin |
| `sara` | `manager123` | Manager |
| `omar` | `viewer123` | Viewer |
| `zara` | `warehouse123` | Warehouse |

### Load Demo Sales Data

After login → go to **Sales** → click **↓ Fetch Shopify** then **↓ Fetch QuickBooks**.
This generates 12 months of realistic order history and populates all forecasts and charts.

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
docker compose exec backend python manage.py seed_data

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
│   ├── users/             # Custom User model + JWT auth
│   ├── products/          # Products, Suppliers, Categories
│   ├── inventory/         # FabricStock, FinishedGoods, Logs
│   ├── sales/             # Orders, mock Shopify/QB data fetch
│   ├── forecasting/       # Demand forecast + reorder alerts
│   ├── settings_app/      # Fetch schedule, system parameters
│   ├── Dockerfile
│   └── entrypoint.sh      # Wait for DB → migrate → seed → gunicorn
├── frontend/
│   ├── src/
│   │   ├── api/client.js  # Axios API client (all endpoints)
│   │   ├── components/    # UI.jsx (shared), Sidebar.jsx
│   │   ├── context/       # AuthContext (JWT, login, logout)
│   │   ├── pages/         # Dashboard, Inventory, Sales, Forecast…
│   │   └── utils/fmt.js   # Money/number formatting helpers
│   ├── nginx.conf         # Nginx inside frontend container
│   └── Dockerfile         # Multi-stage: node build → nginx serve
├── nginx/prod.conf        # Production SSL Nginx config
├── scripts/
│   ├── backup-db.sh       # pg_dump → gzipped backup
│   └── restore-db.sh      # Restore from backup file
├── docker-compose.yml         # LOCAL — hardcoded safe defaults
├── docker-compose.prod.yml    # VPS — external volume + SSL
└── .env.example               # Production env template
```

---

## Database Persistence

PostgreSQL data lives in a **Docker named volume** (`postgres_data`).

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
- Ubuntu 22.04 LTS, minimum 2 vCPU / 2 GB RAM / 20 GB SSD
- Open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS)
- Providers: Hetzner (cheapest), DigitalOcean, Vultr, Linode

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
mkdir -p /opt/greenway && cd /opt/greenway
git clone https://github.com/yourorg/greenway.git .

# Create production .env
cp .env.example .env
nano .env
```

Fill in your `.env`:
```bash
SECRET_KEY=$(openssl rand -base64 50)   # paste output here
DEBUG=False
DB_PASSWORD=YourStrongPassword123!
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com,backend
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
GUNICORN_WORKERS=5
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
# All 5 containers should show "Up"

curl -I https://yourdomain.com
# Should return HTTP/2 200
```

#### 10. Set up daily backups (cron)

```bash
mkdir -p /opt/greenway/backups
chmod +x /opt/greenway/scripts/backup-db.sh

# Add to crontab (runs at 2:00 AM daily)
(crontab -l 2>/dev/null; echo "0 2 * * * cd /opt/greenway && ./scripts/backup-db.sh >> /opt/greenway/backups/backup.log 2>&1") | crontab -
```

---

### Production Management

```bash
cd /opt/greenway
alias prod="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

prod ps                                    # Status
prod logs -f backend                       # Backend logs
prod exec backend python manage.py shell   # Django shell
prod exec db psql -U greenway -d greenway_db  # DB access
prod up -d --build backend frontend        # Deploy update
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
cd /opt/greenway
git pull origin main

# Rebuild and restart — migrations run automatically, DB untouched
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## Connecting Real APIs (Shopify & QuickBooks)

The app ships with a realistic mock data generator. To switch to real APIs:

**Step 1** — Add credentials to `.env`:
```bash
# Shopify
SHOPIFY_SHOP_URL=yourshop.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx

# QuickBooks
QB_CLIENT_ID=xxxxx
QB_CLIENT_SECRET=xxxxx
QB_REALM_ID=xxxxx
QB_REFRESH_TOKEN=xxxxx
```

**Step 2** — Create real integration files:
- `backend/sales/integrations/shopify.py` — implement `fetch_orders(since_date)`
- `backend/sales/integrations/quickbooks.py` — implement `fetch_orders(since_date)`

**Step 3** — Update `backend/sales/views.py` in `_run_fetch()`:
```python
# Replace:
raw_orders = generate_shopify_orders(since, up_to)
# With:
from .integrations.shopify import fetch_orders
raw_orders = fetch_orders(since)
```

---

## Environment Variables Reference

| Variable | Local default | Description |
|---|---|---|
| `SECRET_KEY` | set in compose | Django secret — use `openssl rand -base64 50` for prod |
| `DEBUG` | `True` | Always `False` in production |
| `DB_NAME` | `greenway_db` | PostgreSQL database name |
| `DB_USER` | `greenway` | PostgreSQL username |
| `DB_PASSWORD` | `greenway_secret` | PostgreSQL password — change for prod |
| `DB_HOST` | `db` | Docker service name — don't change |
| `ALLOWED_HOSTS` | `localhost,…` | Comma-separated Django allowed hosts |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:8080` | Comma-separated CORS origins |
| `GUNICORN_WORKERS` | `2` | Workers = 2×CPUs+1 |

---

## Production Security Checklist

- [ ] `SECRET_KEY` is unique random 50+ char string
- [ ] `DEBUG=False`
- [ ] `DB_PASSWORD` is strong (16+ chars)
- [ ] HTTPS working (`curl -I https://yourdomain.com`)
- [ ] UFW firewall enabled (only 22, 80, 443 open)
- [ ] SSH password auth disabled (key-only)
- [ ] Automated daily backups running (`crontab -l`)
- [ ] Default `admin` password changed after first login
