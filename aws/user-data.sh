#!/bin/bash
set -euo pipefail

# Replace REPOSITORY_URL and BRANCH before using this in an EC2 Launch Template.
REPOSITORY_URL="https://github.com/piyushkumar4021/autoscale-web-application.git"
BRANCH="main"
APP_DIRECTORY="/opt/autoscale-web-application"

dnf update -y
dnf install -y git nodejs
git clone --branch "$BRANCH" "$REPOSITORY_URL" "$APP_DIRECTORY"
cd "$APP_DIRECTORY"
npm run install:all
npm run build
npm install --omit=dev --prefix server

cat >/etc/systemd/system/autoscale.service <<'EOF'
[Unit]
Description=AutoScale web application
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/autoscale-web-application
Environment=PORT=3000
ExecStart=/usr/bin/npm start --prefix server
Restart=always
User=ec2-user

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable autoscale
systemctl start autoscale
