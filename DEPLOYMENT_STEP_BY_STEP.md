<!--
  HISTORY NOTE (documentation consolidation): PostgreSQL is now the only
  supported database and the app is multi-tenant (hostname -> platform).
  Steps below referencing SQLite, single-tenant flows, or `prisma migrate dev`
  are outdated. See PROJECT_DOCUMENTATION.md section 11 for the current runbook
  (migrate deploy + seeds, standalone build or Docker Compose).
-->

# 🚀 Deploy StarPath Astrology to OCI - Step by Step

**Domain:** astro.echelonxventures.org
**Database:** PostgreSQL
**Hosting:** Oracle Cloud Infrastructure (Always Free)

---

## PHASE 1: Get Your OCI Details (5 minutes)

### Step 1: Login to Oracle Cloud Console

1. Go to: https://cloud.oracle.com
2. Sign in with your Oracle account

### Step 2: Find Your Compute Instance

1. Click **Hamburger Menu** (☰) → **Compute** → **Instances**
2. Find your VM instance (should say "Running" with green dot)
3. Copy these details:
   - **Public IP Address**: `___.___.___.___`
   - **Username**: `ubuntu`

### Step 3: Find Your SSH Key

The SSH key was created when you launched the instance:

**Linux/Mac:**

```bash
# Check common locations
ls -la ~/.ssh/
# Look for: id_rsa, id_ed25519, or oracle_cloud.pem
```

**Windows (PowerShell):**

```powershell
dir ~\.ssh\
```

If you can't find it, you may need to:

- Check your downloads folder for `.pem` files
- Or create a new SSH key: `ssh-keygen -t ed25519 -f ~/.ssh/oci_key`
- Then add it to OCI Console → Instance → "Add SSH Key"

### Step 4: Test SSH Connection

```bash
# Replace with your actual IP and key
ssh -i ~/.ssh/your_key ubuntu@YOUR_OCI_IP
```

If you see `Welcome to Ubuntu...`, you're ready!

---

## PHASE 2: Prepare Files for Upload (2 minutes)

### On Your Local Machine:

```bash
# Navigate to your project
cd /Users/bipin/Desktop/astro/trustastrology-clone

# Create deployment archive
tar -czf starpath-deploy.tar.gz \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='*.db' \
    --exclude='.env' \
    .

# This creates: starpath-deploy.tar.gz (~500KB)
ls -lh starpath-deploy.tar.gz
```

---

## PHASE 3: Upload Files to OCI (2 minutes)

### From Your Local Machine:

```bash
# Upload the archive to OCI
scp -i ~/.ssh/your_key starpath-deploy.tar.gz ubuntu@YOUR_OCI_IP:~/
```

Wait for upload to complete (should take 1-2 minutes).

---

## PHASE 4: Deploy on OCI Server (15-20 minutes)

### SSH Into Your OCI Instance:

```bash
ssh -i ~/.ssh/your_key ubuntu@YOUR_OCI_IP
```

### Run the Deployment Script:

```bash
# Navigate to home directory
cd ~

# Extract deployment files
tar -xzf starpath-deploy.tar.gz

# Enter the project directory
cd starpath-astrology-clone

# Make deployment script executable
chmod +x deploy-oci.sh

# Run the deployment script
./deploy-oci.sh
```

The script will:

- ✅ Install PostgreSQL
- ✅ Install Node.js 20.x
- ✅ Install PM2, Nginx, Certbot
- ✅ Create database and user
- ✅ Install npm dependencies
- ✅ Run migrations
- ✅ Build the app
- ✅ Configure SSL
- ✅ Start Ollama and pull AI model
- ✅ Save deployment info

**Wait for:** `✅ Deployment Complete!` message (15-20 minutes)

---

## PHASE 5: Verify Deployment (5 minutes)

### Save This Information

The script will display:

- Database credentials (save these!)
- Admin login details
- Management commands

### Open Your Browser:

```
https://astro.echelonxventures.org
```

### Test These:

- [ ] Homepage loads with HTTPS padlock
- [ ] Login page works
- [ ] Login with: `admin@localhost` / `admin123`
- [ ] Dashboard loads
- [ ] Create a birth chart
- [ ] Generate a horoscope

---

## PHASE 6: Critical Security Steps (REQUIRED)

### 1. Change Admin Password

**Option A: Via Web Interface**

1. Login as admin
2. Go to profile settings
3. Change password

**Option B: Via Database**

```bash
# SSH into server
ssh -i ~/.ssh/your_key ubuntu@YOUR_OCI_IP

# Generate new password hash
# (Use an online bcrypt generator for "newpassword123")
# Then update in database:
sqlite3 ~/starpath-astrology/prod.db "UPDATE User SET passwordHash = '<new-hash>' WHERE email = 'admin@localhost';"
```

### 2. Update NEXTAUTH_SECRET (If Not Auto-Generated)

```bash
# Check if .env has a good secret
cat ~/starpath-astrology-clone/.env | grep NEXTAUTH

# If needed, generate new one:
openssl rand -base64 32
# Update .env with new value, then:
pm2 restart starpath-astrology
```

### 3. Review Deployment Info

```bash
cat ~/deployment-info.txt
```

---

## Troubleshooting

### Site Not Loading

```bash
# Check if app is running
pm2 status

# Check Nginx
sudo systemctl status nginx

# Check firewall
sudo ufw status
```

### 502 Bad Gateway

```bash
# App might be down - restart it
pm2 restart starpath-astrology

# Check logs
pm2 logs starpath-astrology --lines 50
```

### Database Connection Error

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Restart if needed
sudo systemctl restart postgresql
```

### AI Not Working

```bash
# Check Ollama
sudo systemctl status ollama
ollama list

# Restart Ollama
sudo systemctl restart ollama
```

---

## Management Commands

### PM2 (Application)

```bash
pm2 status
pm2 logs starpath-astrology
pm2 restart starpath-astrology
pm2 stop starpath-astrology
```

### Nginx (Web Server)

```bash
sudo systemctl status nginx
sudo nginx -t
sudo systemctl restart nginx
```

### PostgreSQL (Database)

```bash
sudo systemctl status postgresql
sudo -u postgres psql
```

### Ollama (AI)

```bash
sudo systemctl status ollama
ollama list
```

### SSL Certificate

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

---

## What's Deployed

| Component     | Status                    |
| ------------- | ------------------------- |
| Node.js 20.x  | ✅ Installed              |
| PostgreSQL    | ✅ Running on port 5432   |
| PM2           | ✅ Managing app process   |
| Nginx         | ✅ Reverse proxy + SSL    |
| Ollama        | ✅ AI model loaded        |
| Let's Encrypt | ✅ SSL certificate        |
| Firewall      | ✅ Ports 22, 80, 443 open |

---

## Cost (OCI Always Free)

| Resource                 | Monthly Cost |
| ------------------------ | ------------ |
| Compute (Ampere A1)      | $0           |
| PostgreSQL (self-hosted) | $0           |
| Storage (200 GB)         | $0           |
| Bandwidth (10 TB)        | $0           |
| **Total**                | **$0.00**    |

---

## Support Files Created

| File               | Location                                   |
| ------------------ | ------------------------------------------ |
| Deployment Script  | `~/starpath-astrology-clone/deploy-oci.sh` |
| Environment Config | `~/starpath-astrology-clone/.env`          |
| DB Credentials     | `~/db_connection.txt`                      |
| Deployment Info    | `~/deployment-info.txt`                    |
| This Guide         | `DEPLOYMENT_STEP_BY_STEP.md`               |

---

## Contact

- **Domain:** astro.echelonxventures.org
- **Email:** privacy@starpathastrology.com

---

**You're ready to deploy!** 🎉

Follow the phases above, and your application will be live in about 30 minutes.
