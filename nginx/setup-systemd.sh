#!/bin/bash
# ApkZio Systemd Service Setup Script

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}ApkZio Systemd Service Setup${NC}"
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
BACKEND_DIR="$PROJECT_ROOT/backends/local-api"
SERVICE_FILE="/etc/systemd/system/apkzio-api.service"

echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

# Check if backend is built
if [ ! -f "$BACKEND_DIR/dist/server.js" ]; then
    echo -e "${RED}Backend not built!${NC}"
    echo "Building backend..."
    cd "$BACKEND_DIR"
    npm run build
else
    echo -e "${GREEN}✓ Backend is built${NC}"
fi

# Check for .env.production file
if [ ! -f "$BACKEND_DIR/.env.production" ]; then
    echo -e "${YELLOW}Warning: .env.production not found${NC}"
    echo "Creating from .env..."
    cp "$BACKEND_DIR/.env" "$BACKEND_DIR/.env.production"
    
    # Update to production settings
    sed -i 's/NODE_ENV=development/NODE_ENV=production/' "$BACKEND_DIR/.env.production"
    sed -i 's/HOST=0.0.0.0/HOST=127.0.0.1/' "$BACKEND_DIR/.env.production"
    sed -i 's/USE_DATABASE=false/USE_DATABASE=true/' "$BACKEND_DIR/.env.production"
    
    echo -e "${YELLOW}Please review and update $BACKEND_DIR/.env.production${NC}"
fi

echo ""
echo -e "${YELLOW}Step 2: Creating systemd service...${NC}"

# Backup existing service if it exists
if [ -f "$SERVICE_FILE" ]; then
    BACKUP_FILE="$SERVICE_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    echo "Backing up existing service to $BACKUP_FILE"
    cp "$SERVICE_FILE" "$BACKUP_FILE"
fi

# Create systemd service file
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=ApkZio API Server
Documentation=https://gitlab.com/franklinclinton.writer/Apps-Builder
After=network.target postgresql.service redis.service
Wants=postgresql.service redis.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$BACKEND_DIR

# Environment variables
Environment="NODE_ENV=production"
Environment="PORT=3001"
Environment="HOST=127.0.0.1"
EnvironmentFile=$BACKEND_DIR/.env.production

# Start command
ExecStart=/usr/bin/node dist/server.js

# Restart policy
Restart=always
RestartSec=10

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=apkzio-api

# Security settings
NoNewPrivileges=true
PrivateTmp=true

# Resource limits
LimitNOFILE=65536
MemoryMax=4G

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✓ Service file created${NC}"

echo ""
echo -e "${YELLOW}Step 3: Reloading systemd...${NC}"

systemctl daemon-reload
echo -e "${GREEN}✓ Systemd reloaded${NC}"

echo ""
echo -e "${YELLOW}Step 4: Enabling service...${NC}"

systemctl enable apkzio-api
echo -e "${GREEN}✓ Service enabled (will start on boot)${NC}"

echo ""
echo -e "${YELLOW}Step 5: Do you want to start the service now? (y/n)${NC}"
read -r response

if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "Starting service..."
    systemctl start apkzio-api
    sleep 2
    
    # Check status
    if systemctl is-active --quiet apkzio-api; then
        echo -e "${GREEN}✓ Service started successfully${NC}"
        
        # Test health endpoint
        echo ""
        echo "Testing health endpoint..."
        sleep 2
        if curl -s http://localhost:3001/health | grep -q "ok"; then
            echo -e "${GREEN}✓ Backend API is responding${NC}"
        else
            echo -e "${YELLOW}Warning: Backend API health check failed${NC}"
        fi
    else
        echo -e "${RED}✗ Service failed to start${NC}"
        echo "Checking logs..."
        journalctl -u apkzio-api -n 20 --no-pager
        exit 1
    fi
else
    echo -e "${YELLOW}Skipping service start. Run 'sudo systemctl start apkzio-api' manually.${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Systemd Setup Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Service file: ${GREEN}$SERVICE_FILE${NC}"
echo -e "Backend dir: ${GREEN}$BACKEND_DIR${NC}"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo ""
echo "Start service:    ${GREEN}sudo systemctl start apkzio-api${NC}"
echo "Stop service:     ${GREEN}sudo systemctl stop apkzio-api${NC}"
echo "Restart service:  ${GREEN}sudo systemctl restart apkzio-api${NC}"
echo "Service status:   ${GREEN}sudo systemctl status apkzio-api${NC}"
echo "View logs:        ${GREEN}sudo journalctl -u apkzio-api -f${NC}"
echo "View last 100:    ${GREEN}sudo journalctl -u apkzio-api -n 100${NC}"
echo ""
echo -e "${GREEN}========================================${NC}"
