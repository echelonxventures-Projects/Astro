#!/bin/bash
# StarPath Astrology - OCI Deployment Script
# Oracle Cloud Infrastructure Always Free Tier
# Domain: astro.echelonxventures.org
# Database: PostgreSQL

set -e

echo "🚀 StarPath Astrology - OCI Deployment"
echo "======================================="

# Configuration
APP_NAME="starpath-astrology"
APP_DIR="/home/ubuntu/$APP_NAME"
DOMAIN="astro.echelonxventures.org"
DB_NAME="starpath"
DB_USER="starpath_user"
DB_PASS="StarPath_$(openssl rand -hex 16)"

echo ""
echo "📋 Deployment Configuration:"
echo "   Domain: $DOMAIN"
echo "   Database: PostgreSQL ($DB_NAME)"
echo "   App Directory: $APP_DIR"
echo ""

# 1. Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install PostgreSQL
echo "🗄️  Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib libpq-dev

# 3. Install Node.js 20.x
echo "📦 Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Install PM2 for process management
echo "📦 Installing PM2..."
sudo npm install -g pm2

# 5. Setup PostgreSQL database
echo "🗄️  Setting up PostgreSQL database..."
sudo -u postgres psql <<EOF
-- Create database and user
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
ALTER DATABASE $DB_NAME OWNER TO $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
EOF

echo "✅ Database created!"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Password: $DB_PASS (save this!)"
echo ""

# Save DB credentials to file
echo "postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME" > ~/db_connection.txt
chmod 600 ~/db_connection.txt

# 6. Install Nginx
echo "🌐 Installing Nginx..."
sudo apt install -y nginx

# 7. Install Certbot for SSL
echo "🔒 Installing Certbot..."
sudo apt install -y certbot python3-certbot-nginx

# 8. Install Ollama for AI
echo "🤖 Installing Ollama..."
curl -fsSL https://ollama.com/install.sh | sh

# 9. Setup application directory
echo "📁 Setting up application directory..."
sudo mkdir -p $APP_DIR
sudo chown ubuntu:ubuntu $APP_DIR
cd $APP_DIR

# 10. Install dependencies
echo "📦 Installing npm dependencies..."
npm install --production

# 11. Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# 12. Create .env from production template
echo "⚙️  Creating environment configuration..."
if [ -f .env.production ]; then
    cp .env.production .env
else
    cat > .env <<ENVEOF
NODE_ENV="production"
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
DIRECT_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
NEXTAUTH_URL="https://$DOMAIN"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
ANTHROPIC_API_KEY=""
OLLAMA_URL="http://localhost:11434"
RESEND_API_KEY=""
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
ENVEOF
fi

# Update DATABASE_URL in .env
sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME\"|g" .env
sed -i "s|DIRECT_URL=.*|DIRECT_URL=\"postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME\"|g" .env

echo "✅ Environment configured!"
echo ""

# 13. Run database migrations
echo "🗄️  Running database migrations..."
npx prisma migrate deploy

# 14. Seed database
echo "🌱 Seeding database..."
npx tsx prisma/seed.ts

# 15. Build application
echo "🔨 Building application..."
npm run build

# 16. Setup PM2
echo "🔄 Setting up PM2..."
pm2 delete $APP_NAME 2>/dev/null || true
pm2 start npm --name $APP_NAME -- start -- -p 3000
pm2 save
pm2 startup

# 17. Configure Nginx
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null <<EOF
# Rate limiting
limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=general:10m rate=30r/s;

server {
    listen 80;
    server_name $DOMAIN;

    # ACME challenge for Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

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
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # API rate limiting
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        limit_req zone=api burst=20 nodelay;
    }

    # Static files caching
    location /_next/static/ {
        proxy_pass http://localhost:3000;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/$APP_NAME
sudo rm -f /etc/nginx/sites-enabled/default

# Create certbot directory
sudo mkdir -p /var/www/certbot

# Test and reload Nginx
echo "🔄 Testing Nginx configuration..."
sudo nginx -t
sudo systemctl restart nginx

# 18. Setup SSL with Let's Encrypt
echo "🔒 Setting up SSL with Let's Encrypt..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect

# 19. Configure firewall
echo "🔥 Configuring firewall..."
sudo ufw allow 'Nginx Full'
sudo ufw allow 'OpenSSH'
sudo ufw --force enable 2>/dev/null || echo "Firewall may already be configured"

# 20. Start Ollama and pull model
echo "🤖 Starting Ollama and pulling model..."
sudo systemctl enable ollama
sudo systemctl start ollama
sleep 5
ollama pull llama3.2

# 21. Save deployment info
echo "📝 Saving deployment information..."
cat > ~/deployment-info.txt <<EOF
===========================================
StarPath Astrology - Deployment Information
===========================================

Domain: https://$DOMAIN
App Directory: $APP_DIR

Database Credentials:
  - Database: $DB_NAME
  - User: $DB_USER
  - Password: $DB_PASS
  - Connection: postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME

Admin Login:
  - Email: admin@localhost
  - Password: admin123
  ⚠️ CHANGE THIS IMMEDIATELY!

PM2 Commands:
  pm2 status $APP_NAME
  pm2 logs $APP_NAME
  pm2 restart $APP_NAME
  pm2 stop $APP_NAME
  pm2 delete $APP_NAME

Nginx Commands:
  sudo systemctl status nginx
  sudo nginx -t
  sudo systemctl restart nginx

SSL Renewal:
  sudo certbot renew --dry-run

Ollama Commands:
  ollama list
  ollama run llama3.2 "Hello"
  sudo systemctl status ollama

Logs:
  tail -f ~/pm2-logs/$APP_NAME-out.log
  sudo tail -f /var/log/nginx/error.log
===========================================
Deployed: $(date)
===========================================
EOF

chmod 600 ~/deployment-info.txt

echo ""
echo "======================================="
echo "✅ Deployment Complete!"
echo "======================================="
echo ""
echo "📍 Application URL: https://$DOMAIN"
echo ""
echo "🔐 Database Credentials:"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Password: $DB_PASS"
echo "   (Also saved to ~/db_connection.txt)"
echo ""
echo "👤 Admin Login:"
echo "   Email: admin@localhost"
echo "   Password: admin123"
echo "   ⚠️  CHANGE THIS IMMEDIATELY!"
echo ""
echo "📊 Management Commands:"
echo "   pm2 status $APP_NAME"
echo "   pm2 logs $APP_NAME"
echo "   pm2 restart $APP_NAME"
echo ""
echo "📝 Deployment info saved to: ~/deployment-info.txt"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "   1. Change admin password from 'admin123'"
echo "   2. Test the application at https://$DOMAIN"
echo "   3. Verify SSL certificate is valid"
echo "   4. Check PM2 logs for any errors"
echo ""
echo "🎉 StarPath Astrology is now LIVE!"
echo ""
