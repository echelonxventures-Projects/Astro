<!--
  HISTORY NOTE (documentation consolidation): PostgreSQL is now the only
  supported database and the app is multi-tenant (hostname -> platform).
  Steps below referencing SQLite, single-tenant flows, or `prisma migrate dev`
  are outdated. See PROJECT_DOCUMENTATION.md section 11 for the current runbook
  (migrate deploy + seeds, standalone build or Docker Compose).
-->

# 🚀 Deploy StarPath Astrology to OCI

## Your Production Details

| Item            | Value                                     |
| --------------- | ----------------------------------------- |
| **Domain**      | astro.echelonxventures.org                |
| **Hosting**     | Oracle Cloud Infrastructure (Always Free) |
| **Port**        | 3000 (internal), 80/443 (public)          |
| **Database**    | SQLite (`prod.db`)                        |
| **AI Provider** | Ollama (free, local) or Anthropic (paid)  |

---

## Quick Deploy (3 Steps)

### Step 1: Copy files to OCI server

```bash
# From your local machine, run in terminal:
scp -i <your-ssh-key>.pem -r ./* ubuntu@<oci-public-ip>:~/starpath-astrology/
```

### Step 2: SSH and run deployment

```bash
# SSH into OCI
ssh -i <your-ssh-key>.pem ubuntu@<oci-public-ip>

# Navigate to app directory
cd ~/starpath-astrology

# Run automated deployment script
./deploy-oci.sh
```

### Step 3: Update environment & restart

```bash
# Generate new secret
openssl rand -base64 32

# Edit .env with new secret
nano .env

# Restart application
pm2 restart starpath-astrology
```

---

## Files Created for Deployment

| File                      | Description                     |
| ------------------------- | ------------------------------- |
| `deploy-oci.sh`           | Automated deployment script     |
| `.env.production`         | Production environment template |
| `DEPLOYMENT_OCI.md`       | Detailed deployment guide       |
| `DEPLOYMENT_CHECKLIST.md` | This quick checklist            |

---

## Pre-Deployment Checklist

- [ ] OCI instance running (Ubuntu 22.04 recommended)
- [ ] SSH key ready
- [ ] Domain `astro.echelonxventures.org` pointing to OCI public IP
- [ ] Port 80 (HTTP) and 443 (HTTPS) open in OCI security rules

---

## Post-Deployment Checklist

- [ ] Visit https://astro.echelonxventures.org
- [ ] Homepage loads with HTTPS
- [ ] Login: `admin@localhost` / `admin123`
- [ ] **Change admin password** (critical!)
- [ ] Test birth chart creation
- [ ] Test horoscope generation
- [ ] Verify Ollama is running: `ollama list`
- [ ] Check logs: `pm2 logs starpath-astrology`

---

## Important Security Actions

### 1. Change Admin Password (URGENT)

After first login, change the default password:

```bash
# Option A: Via database (SQLite)
sqlite3 prod.db "UPDATE User SET passwordHash = '<new-hash>' WHERE email = 'admin@localhost';"

# Option B: Create new admin via UI, then delete old one
```

### 2. Generate New NEXTAUTH_SECRET

```bash
openssl rand -base64 32
# Copy output to .env as NEXTAUTH_SECRET
pm2 restart starpath-astrology
```

### 3. Configure Firewall (done by deploy script)

```bash
sudo ufw status
# Should show: 22/tcp, 80/tcp, 443/tcp allowed
```

---

## Monitoring & Maintenance

### Check Application Status

```bash
pm2 status
pm2 logs starpath-astrology --lines 50
```

### Check SSL Certificate

```bash
sudo certbot certificates
```

### Auto-renew SSL

```bash
# Already configured, but test it:
sudo certbot renew --dry-run
```

### Update Application

```bash
cd ~/starpath-astrology
git pull  # if using git
npm install
npm run build
pm2 restart starpath-astrology
```

---

## Troubleshooting

### "Site can't be reached"

```bash
# Check if app is running
pm2 status

# Check Nginx
sudo systemctl status nginx

# Check firewall
sudo ufw status
```

### "502 Bad Gateway"

```bash
# App might be down
pm2 logs starpath-astrology

# Restart app
pm2 restart starpath-astrology
```

### AI not working

```bash
# Check Ollama
systemctl status ollama
ollama list

# Restart Ollama
sudo systemctl restart ollama

# Test Ollama
curl http://localhost:11434/api/generate -d '{"model":"llama3.2","prompt":"Hello"}'
```

---

## Cost Estimate (OCI Always Free)

| Resource                      | Cost         |
| ----------------------------- | ------------ |
| Compute (VM.Standard.A1.Flex) | FREE         |
| Storage (200 GB)              | FREE         |
| Bandwidth (10 TB/month)       | FREE         |
| **Total**                     | **$0/month** |

---

## Contact & Support

- **Domain:** astro.echelonxventures.org
- **Email:** privacy@starpathastrology.com
- **Docs:** See `DEPLOYMENT_OCI.md` for detailed guide

---

## You're Ready to Go Live! 🎉

After deployment, your application will be accessible at:
**https://astro.echelonxventures.org**

**Important:** Remember to change the admin password immediately after first login!
