#!/bin/bash
set -euxo pipefail

# Replace every value before using this script in a Compute Engine instance template.
REPOSITORY_URL="https://github.com/piyushkumar4021/autoscale-web-application"
BRANCH="main"
APP_DIRECTORY="/opt/autoscale-web-application"
GCP_PROJECT_ID="auto-scale-cloud-demo"
GCP_ZONE="asia-south1-a"
GCP_MIG_NAME="autoscale-mig"
GCP_BACKEND_SERVICE="autoscale-backend"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

useradd --system --create-home --shell /usr/sbin/nologin autoscale || true
git clone --branch "$BRANCH" "$REPOSITORY_URL" "$APP_DIRECTORY"
cd "$APP_DIRECTORY"
npm ci --omit=dev --prefix server
npm ci --prefix client
npm run build
chown -R autoscale:autoscale "$APP_DIRECTORY"

cat >/etc/systemd/system/autoscale.service <<EOF
[Unit]
Description=AutoScale web application
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIRECTORY
Environment=PORT=3000
Environment=GCP_PROJECT_ID=$GCP_PROJECT_ID
Environment=GCP_ZONE=$GCP_ZONE
Environment=GCP_MIG_NAME=$GCP_MIG_NAME
Environment=GCP_BACKEND_SERVICE=$GCP_BACKEND_SERVICE
ExecStart=/usr/bin/npm start --prefix server
Restart=always
RestartSec=5
User=autoscale

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable autoscale
systemctl start autoscale
