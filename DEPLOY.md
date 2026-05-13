# Private Server Deployment Guide — ListingAuditor

This guide walks you through deploying the ListingAuditor SaaS platform on your own private server (Ubuntu/Debian VPS, AWS EC2, DigitalOcean Droplet, etc.).

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 20+ (24 recommended) | Use nvm to install |
| pnpm | 9+ | `npm i -g pnpm` |
| PostgreSQL | 15+ | Can use managed DB (RDS, Supabase, Neon) |
| Nginx | Latest | Reverse proxy |
| PM2 | Latest | Process manager |
| Domain | — | With DNS pointing to your server |
| SSL Certificate | — | Let's Encrypt (free) |

---

## Step 1 — Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 24 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 24 && nvm use 24

# Install pnpm
npm install -g pnpm

# Install PM2 (process manager)
npm install -g pm2

# Install Nginx
sudo apt install nginx -y

# Install Certbot (Let's Encrypt SSL)
sudo apt install certbot python3-certbot-nginx -y
```

---

## Step 2 — PostgreSQL Database

### Option A: Local PostgreSQL
```bash
sudo apt install postgresql postgresql-contrib -y
sudo -u postgres psql
CREATE DATABASE listingauditor;
CREATE USER lauser WITH ENCRYPTED PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE listingauditor TO lauser;
\q
```

### Option B: Managed DB (recommended)
Use [Neon](https://neon.tech), [Supabase](https://supabase.com), or AWS RDS.
Copy the connection string — you'll need it in Step 4.

---

## Step 3 — Clone and Build

```bash
# Clone your repository
git clone https://github.com/YOUR_ORG/listing-auditor.git /opt/listingauditor
cd /opt/listingauditor

# Install dependencies
pnpm install --frozen-lockfile

# Build all packages
pnpm run build
```

---

## Step 4 — Environment Variables

Create `/opt/listingauditor/.env` (never commit this file):

```env
# Database
DATABASE_URL=postgresql://lauser:yourpassword@localhost:5432/listingauditor

# Clerk Auth — get from dashboard.clerk.com
CLERK_SECRET_KEY=sk_live_XXXXXXXXXXXXXXXX
CLERK_PUBLISHABLE_KEY=pk_live_XXXXXXXXXXXXXXXX

# Clerk Proxy (for production white-label)
CLERK_PROXY_URL=https://yourdomain.com/clerk

# Admin user IDs (comma-separated Clerk user IDs)
ADMIN_USER_IDS=user_XXXXXXXX,user_YYYYYYYY

# OpenAI (via Replit AI Integrations or direct key)
OPENAI_API_KEY=sk-XXXXXXXXXXXXXXXX

# Session secret (random 32+ char string)
SESSION_SECRET=change_me_to_a_random_64_char_string_here

# Node env
NODE_ENV=production
PORT=8080
```

---

## Step 5 — Run DB Migrations

```bash
cd /opt/listingauditor
pnpm --filter @workspace/db run push
```

---

## Step 6 — Build the Frontend

```bash
cd /opt/listingauditor

# Set build-time env vars for Vite
export VITE_CLERK_PUBLISHABLE_KEY=pk_live_XXXXXXXXXXXXXXXX
export VITE_ADMIN_USER_IDS=user_XXXXXXXX,user_YYYYYYYY
export BASE_URL=/

# Build frontend static files
pnpm --filter @workspace/listing-auditor run build
# Output goes to: artifacts/listing-auditor/dist/
```

---

## Step 7 — Start the API Server with PM2

```bash
cd /opt/listingauditor/artifacts/api-server

# Load env and start
pm2 start dist/index.mjs --name "listing-auditor-api" --env production

# Save PM2 config so it restarts on reboot
pm2 save
pm2 startup
# Follow the command it prints to register the startup hook
```

---

## Step 8 — Configure Nginx

Create `/etc/nginx/sites-available/listingauditor`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Serve frontend static files
    root /opt/listingauditor/artifacts/listing-auditor/dist;
    index index.html;

    # API proxy → Express server
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # Clerk proxy (production white-label)
    location /clerk/ {
        proxy_pass https://clerk.yourdomain.com/;
        proxy_set_header Host clerk.yourdomain.com;
        proxy_ssl_server_name on;
    }

    # SPA fallback — serve index.html for all other routes
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/listingauditor /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## Step 9 — Clerk Production Setup

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) → your app → **API Keys**
2. Switch from Development to **Production** instance
3. Set your production domain in Clerk settings
4. Update `CLERK_SECRET_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` with the **live** keys (`sk_live_` / `pk_live_`)
5. Under **Domains**, add `yourdomain.com` as an allowed origin

---

## Step 10 — Verify Deployment

```bash
# Check API is responding
curl https://yourdomain.com/api/healthz

# Check PM2 status
pm2 status

# View API logs
pm2 logs listing-auditor-api --lines 50

# Check Nginx
sudo systemctl status nginx
```

---

## Updating the App

```bash
cd /opt/listingauditor

# Pull latest code
git pull origin main

# Install any new deps
pnpm install --frozen-lockfile

# Rebuild
pnpm run build
pnpm --filter @workspace/listing-auditor run build

# Run any new migrations
pnpm --filter @workspace/db run push

# Restart API
pm2 restart listing-auditor-api
```

---

## Admin Access After Deployment

1. Sign up at `https://yourdomain.com/sign-up` with your admin email
2. Find your Clerk User ID in [dashboard.clerk.com](https://dashboard.clerk.com) → Users → click your user → copy the `user_XXXXXXXX` ID
3. Add it to `ADMIN_USER_IDS` in your `.env` file and rebuild/restart
4. Visit `https://yourdomain.com/admin` to access the Super Admin Panel

---

## Troubleshooting

| Issue | Fix |
|---|---|
| API 502 | PM2 crashed — run `pm2 logs` to see the error |
| Blank page | Check `dist/` was built, Nginx root path is correct |
| Clerk auth failing | Ensure production keys are set, domain is whitelisted in Clerk |
| DB connection refused | Check `DATABASE_URL` format and firewall rules |
| "Port already in use" | `pm2 delete all && pm2 start ...` |

---

## Security Checklist

- [ ] `.env` file permissions: `chmod 600 .env`
- [ ] Firewall: only ports 22, 80, 443 open (`ufw allow ...`)
- [ ] PostgreSQL not exposed externally (bind to localhost)
- [ ] `SESSION_SECRET` is a unique 64-char random string
- [ ] Clerk using production (live) keys
- [ ] Regular DB backups configured (pg_dump cron or managed DB backups)
