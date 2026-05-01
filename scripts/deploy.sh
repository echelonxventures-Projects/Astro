#!/bin/bash
# StarPath Astrology - Deployment Script for OCI
# Run this script on the OCI server to deploy the application

set -e

echo "========================================"
echo "StarPath Astrology - Deployment Script"
echo "========================================"

# Configuration
APP_NAME="starpath-astrology"
APP_DIR="/home/opc/starpath"
NODE_VERSION="20"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    log_error "Please do not run this script as root"
    exit 1
fi

# Step 1: Check Node.js installation
log_info "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    log_warn "Node.js not found. Installing Node.js ${NODE_VERSION}..."

    # Install Node.js using NodeSource
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs

    log_info "Node.js installed successfully"
else
    NODE_VER=$(node -v)
    log_info "Node.js ${NODE_VER} is already installed"
fi

# Step 2: Check npm installation
log_info "Checking npm installation..."
if ! command -v npm &> /dev/null; then
    log_error "npm not found. Please install Node.js and npm first"
    exit 1
fi

NPM_VER=$(npm -v)
log_info "npm ${NPM_VER} is installed"

# Step 3: Install PM2 if not exists
log_info "Checking PM2 installation..."
if ! command -v pm2 &> /dev/null; then
    log_warn "PM2 not found. Installing PM2..."
    sudo npm install -g pm2
    log_info "PM2 installed successfully"
else
    PM2_VER=$(pm2 -v)
    log_info "PM2 ${PM2_VER} is already installed"
fi

# Step 4: Create application directory
log_info "Setting up application directory..."
mkdir -p ${APP_DIR}
cd ${APP_DIR}

# Step 5: Check if deployment package exists
if [ -f "starpath-deploy.tar.gz" ]; then
    log_info "Extracting deployment package..."
    tar -xzf starpath-deploy.tar.gz
    log_info "Files extracted successfully"
else
    log_warn "Deployment package not found. Please upload starpath-deploy.tar.gz to ${APP_DIR}"
    exit 1
fi

# Step 6: Install dependencies
log_info "Installing npm dependencies..."
npm install --production

# Step 7: Setup environment file
if [ ! -f ".env.production" ]; then
    log_info "Creating .env.production from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env.production
    else
        cat > .env.production << 'EOF'
NODE_ENV=production
DATABASE_URL="file:./prod.db"
DIRECT_URL="file:./prod.db"
NEXTAUTH_URL="https://astro.echelonxventures.org"
NEXTAUTH_SECRET="change-this-to-a-random-string"
OPENROUTER_API_KEY="your-openrouter-api-key"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
STRIPE_SECRET_KEY="your-stripe-secret-key"
STRIPE_WEBHOOK_SECRET="your-stripe-webhook-secret"
RAZORPAY_KEY_ID="your-razorpay-key-id"
RAZORPAY_KEY_SECRET="your-razorpay-key-secret"
RAZORPAY_WEBHOOK_SECRET="your-razorpay-webhook-secret"
EOF
    fi
    log_warn "Please edit .env.production with your actual values!"
else
    log_info ".env.production already exists"
fi

# Step 8: Generate Prisma client
log_info "Generating Prisma client..."
npx prisma generate

# Step 9: Push database schema
log_info "Setting up database..."
npx prisma db push

# Step 10: Build application
log_info "Building application..."
npm run build

# Step 11: Stop existing PM2 process
log_info "Stopping existing PM2 process (if any)..."
pm2 stop ${APP_NAME} 2>/dev/null || true
pm2 delete ${APP_NAME} 2>/dev/null || true

# Step 12: Start application with PM2
log_info "Starting application with PM2..."
pm2 start npm --name ${APP_NAME} -- start

# Step 13: Save PM2 configuration
log_info "Saving PM2 configuration..."
pm2 save

# Step 14: Setup PM2 startup
log_info "Setting up PM2 startup..."
pm2 startup | sudo bash

# Step 15: Show status
echo ""
echo "========================================"
log_info "Deployment completed successfully!"
echo "========================================"
echo ""
pm2 status
echo ""
log_info "Next steps:"
echo "1. Edit .env.production with your actual values"
echo "2. Configure payment gateways in the database"
echo "3. Set up webhook URLs in Razorpay and Stripe dashboards"
echo "4. Restart the app: pm2 restart ${APP_NAME}"
echo ""
log_info "View logs: pm2 logs ${APP_NAME}"
log_info "Monitor: pm2 monit"
