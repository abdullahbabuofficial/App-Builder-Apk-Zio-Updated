#!/bin/bash
# ApkZio Nginx Deployment Script
# This script installs and configures nginx for production

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}ApkZio Nginx Production Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root (sudo)${NC}"
    exit 1
fi

# Define paths
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NGINX_CONF="$SCRIPT_DIR/apkzio-production.conf"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available/apkzio"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled/apkzio"

echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    echo -e "${RED}Nginx is not installed!${NC}"
    echo "Installing nginx..."
    apt update
    apt install -y nginx
else
    echo -e "${GREEN}✓ Nginx is installed${NC}"
    nginx -v
fi

# Check if backend is built
if [ ! -f "$PROJECT_ROOT/backends/local-api/dist/server.js" ]; then
    echo -e "${YELLOW}Backend not built. Building...${NC}"
    cd "$PROJECT_ROOT/backends/local-api"
    npm run build
else
    echo -e "${GREEN}✓ Backend is built${NC}"
fi

# Check if admin frontend is built
if [ ! -d "$PROJECT_ROOT/apkzio-admin/dist" ]; then
    echo -e "${YELLOW}Admin frontend not built. Building...${NC}"
    cd "$PROJECT_ROOT/apkzio-admin"
    npm run build
else
    echo -e "${GREEN}✓ Admin frontend is built${NC}"
fi

# Check if public frontend is built
if [ ! -d "$PROJECT_ROOT/apkzio-pub/dist" ]; then
    echo -e "${YELLOW}Public frontend not built. Building...${NC}"
    cd "$PROJECT_ROOT/apkzio-pub"
    npm run build
else
    echo -e "${GREEN}✓ Public frontend is built${NC}"
fi

echo ""
echo -e "${YELLOW}Step 2: Installing nginx configuration...${NC}"

# Backup existing config if it exists
if [ -f "$NGINX_SITES_AVAILABLE" ]; then
    BACKUP_FILE="/etc/nginx/sites-available/apkzio.backup.$(date +%Y%m%d_%H%M%S)"
    echo "Backing up existing config to $BACKUP_FILE"
    cp "$NGINX_SITES_AVAILABLE" "$BACKUP_FILE"
fi

# Copy new configuration
echo "Copying nginx configuration..."
cp "$NGINX_CONF" "$NGINX_SITES_AVAILABLE"

# Update paths in nginx config to match actual project location
sed -i "s|/root/home/apkzio|$PROJECT_ROOT|g" "$NGINX_SITES_AVAILABLE"

echo -e "${GREEN}✓ Configuration copied${NC}"

echo ""
echo -e "${YELLOW}Step 3: Creating symbolic link...${NC}"

# Remove existing symlink
if [ -L "$NGINX_SITES_ENABLED" ]; then
    echo "Removing existing symlink..."
    rm -f "$NGINX_SITES_ENABLED"
fi

# Create new symlink
ln -s "$NGINX_SITES_AVAILABLE" "$NGINX_SITES_ENABLED"
echo -e "${GREEN}✓ Symlink created${NC}"

echo ""
echo -e "${YELLOW}Step 4: Testing nginx configuration...${NC}"

if nginx -t; then
    echo -e "${GREEN}✓ Nginx configuration is valid${NC}"
else
    echo -e "${RED}✗ Nginx configuration has errors!${NC}"
    echo "Restoring backup..."
    if [ -f "$BACKUP_FILE" ]; then
        cp "$BACKUP_FILE" "$NGINX_SITES_AVAILABLE"
    fi
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 5: Do you want to reload nginx now? (y/n)${NC}"
read -r response

if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "Reloading nginx..."
    systemctl reload nginx
    echo -e "${GREEN}✓ Nginx reloaded successfully${NC}"
else
    echo -e "${YELLOW}Skipping nginx reload. Run 'sudo systemctl reload nginx' manually.${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Configuration file: ${GREEN}$NGINX_SITES_AVAILABLE${NC}"
echo -e "Project root: ${GREEN}$PROJECT_ROOT${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Configure SSL certificates:"
echo "   ${GREEN}sudo certbot --nginx -d api.apkzio.com${NC}"
echo "   ${GREEN}sudo certbot --nginx -d admin.apkzio.com${NC}"
echo "   ${GREEN}sudo certbot --nginx -d apkzio.com -d www.apkzio.com${NC}"
echo ""
echo "2. Set up systemd service for backend:"
echo "   ${GREEN}cd $SCRIPT_DIR${NC}"
echo "   ${GREEN}sudo ./setup-systemd.sh${NC}"
echo ""
echo "3. Test your deployment:"
echo "   ${GREEN}curl https://api.apkzio.com/health${NC}"
echo "   ${GREEN}curl -I https://admin.apkzio.com${NC}"
echo "   ${GREEN}curl -I https://apkzio.com${NC}"
echo ""
echo -e "${GREEN}========================================${NC}"
