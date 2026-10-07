import os from 'node:os';

function instanceDetails() {
  return {
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    nodeVersion: process.version,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  };
}

export function getInstance(_req, res) {
  res.json(instanceDetails());
}

export function getStatus(_req, res) {
  res.json({ status: 'healthy', application: 'AutoScale', ...instanceDetails() });
}

export function health(_req, res) {
  res.status(200).json({ status: 'healthy' });
}
