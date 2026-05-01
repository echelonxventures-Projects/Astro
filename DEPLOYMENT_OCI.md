# StarPath Astrology - OCI Deployment Guide

## Deploy to Oracle Cloud Infrastructure (Always Free)

**Domain:** astro.echelonxventures.org

---

## Option A: Automated Deployment (Recommended)

### 1. SSH into your OCI instance

```bash
ssh -i <your-key>.pem ubuntu@<your-oci-ip>
```

### 2. Transfer project files

```bash
# From your local machine
scp -i <your-key>.pem -r ./* ubuntu@<your-oci-ip>:~/starpath-astrology/
```

### 3. Run the deployment script

```bash
cd ~/starpath-astrology
./deploy-oci.sh
```

### 4. Update environment variables

```bash
# Generate new secret
openssl rand -base64 32

# Edit .env
nano .env

# Update:
# - NEXTAUTH_SECRET="<new-secret>"
# - ANTHROPIC_API_KEY="<your-key>" (or leave empty for Ollama)
```

### 5. Restart application

```bash
pm2 restart starpath-astrology
```

---

## Option B: Manual Deployment

### Step 1: Connect to OCI Instance

```bash
ssh -i <your-ssh-key>.pem ubuntu@<your-oci-public-ip>
```

### Step 2: Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Step 3: Install PM2

```bash
sudo npm install -g pm2
```

### Step 4: Setup Application

```bash
mkdir ~/starpath-astrology
cd ~/starpath-astrology

# Copy files via SCP from local machine
# Or clone from Git:
# git clone <your-repo-url> .
```

### Step 5: Install Dependencies

```bash
npm install --production
npx prisma generate
```

### Step 6: Configure Environment

```bash
cp .env.production .env
nano .env
```

**Update these values:**
```bash
NODE_ENV="production"
DATABASE_URL="file:./prod.db"
NEXTAUTH_URL="https://astro.echelonxventures.org"
NEXTAUTH_SECRET="<generate-new-secret>"
ANTHROPIC_API_KEY=""  # Or your Anthropic key
OLLAMA_URL="http://localhost:11434"  # If using Ollama
```

### Step 7: Setup Database

```bash
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

### Step 8: Build Application

```bash
npm run build
```

### Step 9: Start with PM2

```bash
pm2 start npm --name "starpath-astrology" -- start -- -p 3000
pm2 save
pm2 startup
```

### Step 10: Install & Configure Nginx

```bash
sudo apt update
sudo apt install -y nginx

sudo tee /etc/nginx/sites-available/starpath > /dev/null <<EOF
server {
    listen 80;
    server_name astro.echelonxventures.org;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /_next/static/ {
        proxy_pass http://localhost:3000;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/starpath /etc/nginx/sites-enabled/starpath
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### Step 11: Setup SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d astro.echelonxventures.org --non-interactive --agree-tos --email admin@echelonxventures.org
```

### Step 12: Install Ollama (Free AI)

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2
```

---

## Post-Deployment Checklist

- [ ] Visit https://astro.echelonxventures.org
- [ ] Test homepage loads
- [ ] Login as admin: `admin@localhost` / `admin123`
- [ ] **Change admin password immediately**
- [ ] Test birth chart creation
- [ ] Test horoscope generation
- [ ] Verify SSL certificate is valid
- [ ] Check PM2 logs: `pm2 logs starpath-astrology`

---

## Useful Commands

### Application Management
```bash
pm2 status
pm2 logs starpath-astrology
pm2 restart starpath-astrology
pm2 stop starpath-astrology
pm2 delete starpath-astrology
```

### Nginx
```bash
sudo systemctl status nginx
sudo nginx -t
sudo systemctl restart nginx
```

### SSL Renewal
```bash
sudo certbot renew --dry-run
```

### Firewall
```bash
sudo ufw status
sudo ufw allow 'Nginx Full'
sudo ufw allow 'OpenSSH'
```

---

## Troubleshooting

### Application not responding
```bash
pm2 logs starpath-astrology
pm2 restart starpath-astrology
```

### Nginx errors
```bash
sudo nginx -t
sudo systemctl status nginx
```

### Database errors
```bash
npx prisma generate
npx prisma migrate deploy
```

### AI not working
```bash
# Check Ollama
ollama list
ollama run llama3.2 "Hello"

# Or set Anthropic API key in .env
```

---

## Files Deployed

| File | Purpose |
|------|---------|
| `.env.production` | Production environment template |
| `deploy-oci.sh` | Automated deployment script |
| `DEPLOYMENT_OCI.md` | This guide |

---

## Contact

- Email: privacy@starpathastrology.com
- Domain: astro.echelonxventures.org

---

**Ready to deploy!** 🚀
