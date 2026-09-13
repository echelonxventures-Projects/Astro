<!--
  HISTORY NOTE (documentation consolidation): PostgreSQL is now the only
  supported database and the app is multi-tenant (hostname -> platform).
  Steps below referencing SQLite, single-tenant flows, or `prisma migrate dev`
  are outdated. See PROJECT_DOCUMENTATION.md section 11 for the current runbook
  (migrate deploy + seeds, standalone build or Docker Compose).
-->

# StarPath Astrology - Deployment Preparation

## Step 1: Get Your OCI Server Details

### Find Your Public IP Address

1. Login to Oracle Cloud Console: https://cloud.oracle.com
2. Go to **Compute** → **Instances**
3. Find your instance (e.g., "starpath-astrology" or similar)
4. Copy the **Public IP Address** (looks like: `129.150.100.xxx`)

### Find Your SSH Key

Your SSH key was created when you launched the instance. Common locations:

- `~/.ssh/id_rsa` (Linux/Mac)
- `C:\Users\YourName\.ssh\id_rsa` (Windows)
- Or the `.pem` file you downloaded from OCI

### Test SSH Connection

```bash
# Replace with your actual IP and key path
ssh -i ~/.ssh/id_rsa ubuntu@<your-oci-public-ip>
```

If connection succeeds, you're ready!

---

## Step 2: PostgreSQL Setup Options

Since you chose PostgreSQL, you have two options:

### Option A: Use OCI Always Free Autonomous PostgreSQL (Recommended)

1. Go to OCI Console → **Oracle Database** → **PostgreSQL**
2. Click **Create DB System**
3. Choose **Always Free** tier
4. Note the connection string (will look like):
   ```
   postgresql://user:password@host:port/starpath
   ```

### Option B: Install PostgreSQL on the Same VM (Simpler)

The deployment script will install PostgreSQL automatically on your OCI instance.

---

## Step 3: Run Deployment Commands

Once you have your OCI details, run these commands **on your local machine** to copy files:

```bash
# Create a deployment folder
mkdir -p ~/starpath-deploy
cd ~/starpath-deploy

# Copy your project files (from your project directory)
cp -r /Users/bipin/Desktop/astro/trustastrology-clone/* .

# Create deployment archive
tar -czf starpath-deploy.tar.gz *
```

Then upload to server:

```bash
# Upload to OCI
scp -i <your-ssh-key> starpath-deploy.tar.gz ubuntu@<oci-ip>:~/
```

---

## Step 4: SSH and Deploy

```bash
# SSH into your OCI instance
ssh -i <your-ssh-key> ubuntu@<oci-ip>

# Once connected, run:
cd ~

# Install PostgreSQL (if not using OCI Autonomous)
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Create database
sudo -u postgres psql <<EOF
CREATE DATABASE starpath;
CREATE USER starpath_user WITH PASSWORD 'change_this_password_123';
GRANT ALL PRIVILEGES ON DATABASE starpath TO starpath_user;
EOF

# Extract deployment files
tar -xzf starpath-deploy.tar.gz
cd starpath-deploy

# Run the deployment script
chmod +x deploy-oci.sh
./deploy-oci.sh
```

---

## What I Need From You

Please provide the following (or check the boxes):

- [ ] OCI Public IP Address: `___.___.___.___`
- [ ] SSH Key Path: `~/.ssh/_____`
- [ ] PostgreSQL Choice: [ ] OCI Autonomous [ ] Install on VM

---

## Quick Test

Once you have your OCI IP, test connection:

```bash
ssh -i <your-key-path> ubuntu@<your-oci-ip>
```

If you see `Welcome to Ubuntu...`, you're ready to deploy!

---

## Files Ready for Deployment

| File                      | Status                           |
| ------------------------- | -------------------------------- |
| `deploy-oci.sh`           | ✅ Ready                         |
| `.env.production`         | ✅ Ready (PostgreSQL configured) |
| `DEPLOYMENT_OCI.md`       | ✅ Ready                         |
| `DEPLOYMENT_CHECKLIST.md` | ✅ Ready                         |

---

**Next:** Once you have your OCI details, let me know and I'll guide you through each command!
