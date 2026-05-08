#!/bin/bash
# Quick Admin Dashboard Update Script

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Updating Admin Dashboard${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

cd /root/home/apkzio/apkzio-admin

echo -e "${YELLOW}1. Building admin dashboard...${NC}"
npm run build

echo -e "${YELLOW}2. Deploying to production...${NC}"
sudo cp -r dist/* /var/www/apkzio/admin/
sudo chown -R www-data:www-data /var/www/apkzio/admin

echo -e "${GREEN}✓ Admin dashboard updated!${NC}"
echo ""
echo "Access at: https://admin.apkzio.com"
