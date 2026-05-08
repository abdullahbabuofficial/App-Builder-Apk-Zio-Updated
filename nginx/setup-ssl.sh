#!/bin/bash
# ApkZio SSL Certificate Setup Script (Let's Encrypt)

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}ApkZio SSL Certificate Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root (sudo)${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}Certbot is not installed. Installing...${NC}"
    apt update
    apt install -y certbot python3-certbot-nginx
else
    echo -e "${GREEN}✓ Certbot is installed${NC}"
    certbot --version
fi

# Check if nginx is running
if ! systemctl is-active --quiet nginx; then
    echo -e "${RED}Nginx is not running!${NC}"
    echo "Starting nginx..."
    systemctl start nginx
fi

echo ""
echo -e "${YELLOW}Step 2: Listing domains to configure...${NC}"
echo ""
echo "The following domains will be configured:"
echo "  1. ${GREEN}api.apkzio.com${NC} (Backend API)"
echo "  2. ${GREEN}admin.apkzio.com${NC} (Admin Dashboard)"
echo "  3. ${GREEN}apkzio.com + www.apkzio.com${NC} (Public Frontend)"
echo ""

echo -e "${YELLOW}Important:${NC}"
echo "  - Ensure all domains point to this server's IP address"
echo "  - DNS records should be configured before proceeding"
echo "  - Port 80 and 443 must be open in firewall"
echo ""

# Check if domains are reachable
echo -e "${YELLOW}Step 3: Checking DNS resolution...${NC}"
echo ""

check_dns() {
    local domain=$1
    if host "$domain" &> /dev/null; then
        echo -e "${GREEN}✓ $domain resolves${NC}"
        return 0
    else
        echo -e "${RED}✗ $domain does not resolve${NC}"
        return 1
    fi
}

DNS_OK=true
check_dns "api.apkzio.com" || DNS_OK=false
check_dns "admin.apkzio.com" || DNS_OK=false
check_dns "apkzio.com" || DNS_OK=false
check_dns "www.apkzio.com" || DNS_OK=false

if [ "$DNS_OK" = false ]; then
    echo ""
    echo -e "${RED}Some domains are not resolving!${NC}"
    echo "Please configure your DNS records first."
    echo ""
    echo -e "${YELLOW}Do you want to continue anyway? (y/n)${NC}"
    read -r response
    if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "Exiting..."
        exit 1
    fi
fi

echo ""
echo -e "${YELLOW}Step 4: Enter your email for Let's Encrypt notifications:${NC}"
read -r EMAIL

if [ -z "$EMAIL" ]; then
    echo -e "${RED}Email is required!${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 5: Obtaining SSL certificates...${NC}"
echo ""

# Function to get certificate
get_cert() {
    local domains=$1
    echo -e "${YELLOW}Getting certificate for: $domains${NC}"
    
    if certbot --nginx --non-interactive --agree-tos --email "$EMAIL" \
        --redirect --hsts --staple-ocsp \
        -d "$domains"; then
        echo -e "${GREEN}✓ Certificate obtained for $domains${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed to get certificate for $domains${NC}"
        return 1
    fi
}

# Get certificates for each domain
echo ""
echo "1/3: API domain..."
get_cert "api.apkzio.com" || echo -e "${YELLOW}Warning: Could not get cert for api.apkzio.com${NC}"

echo ""
echo "2/3: Admin domain..."
get_cert "admin.apkzio.com" || echo -e "${YELLOW}Warning: Could not get cert for admin.apkzio.com${NC}"

echo ""
echo "3/3: Public domain..."
get_cert "apkzio.com,www.apkzio.com" || echo -e "${YELLOW}Warning: Could not get cert for apkzio.com${NC}"

echo ""
echo -e "${YELLOW}Step 6: Verifying certificates...${NC}"
echo ""

certbot certificates

echo ""
echo -e "${YELLOW}Step 7: Testing auto-renewal...${NC}"

if certbot renew --dry-run; then
    echo -e "${GREEN}✓ Auto-renewal is configured correctly${NC}"
else
    echo -e "${RED}✗ Auto-renewal test failed${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}SSL Setup Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Certificate Information:${NC}"
echo ""
echo "View certificates:  ${GREEN}sudo certbot certificates${NC}"
echo "Renew manually:     ${GREEN}sudo certbot renew${NC}"
echo "Revoke certificate: ${GREEN}sudo certbot revoke --cert-path /etc/letsencrypt/live/DOMAIN/cert.pem${NC}"
echo ""
echo -e "${YELLOW}Auto-renewal:${NC}"
echo "Certbot will automatically renew certificates before they expire."
echo "Check renewal service: ${GREEN}sudo systemctl status certbot.timer${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Test HTTPS endpoints:"
echo "   ${GREEN}curl https://api.apkzio.com/health${NC}"
echo "   ${GREEN}curl -I https://admin.apkzio.com${NC}"
echo "   ${GREEN}curl -I https://apkzio.com${NC}"
echo ""
echo "2. Test SSL configuration:"
echo "   ${GREEN}openssl s_client -connect api.apkzio.com:443 -servername api.apkzio.com${NC}"
echo ""
echo "3. Check SSL Labs rating:"
echo "   ${GREEN}https://www.ssllabs.com/ssltest/analyze.html?d=api.apkzio.com${NC}"
echo ""
echo -e "${GREEN}========================================${NC}"
