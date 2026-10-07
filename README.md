# AutoScale — Dynamic Web Application for Peak Traffic Management

A complete college cloud-computing project application demonstrating a stateless React and Node.js service designed for AWS Application Load Balancer and EC2 Auto Scaling.

## Included features

- React interface with Home, System Status, Performance Lab, and About views
- Express APIs: `/health`, `/api/instance`, `/api/status`, and `/api/workload/:level`
- A lightweight ALB-compatible health endpoint
- Controlled `light`, `medium`, and `heavy` CPU workloads that identify the serving host
- Performance Lab cards for active instances, average CPU, healthy ALB targets, requests per target, and response time after AWS configuration
- k6 tests and an EC2 user-data starter script

## Run locally

```bash
npm install
npm run install:all
npm run dev
```

Open `http://localhost:5173`. The Express API runs at `http://localhost:3000`.

## Production-style run

```bash
npm run build
npm start
```

Open `http://localhost:3000`; Express serves the built React frontend and API together, matching the intended EC2 deployment model.

## API reference

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/health` | Lightweight target-group health check |
| GET | `/api/instance` | EC2 hostname, uptime, platform, Node version |
| GET | `/api/status` | Application health and instance details |
| GET | `/api/workload/light` | Low CPU test |
| GET | `/api/workload/medium` | Medium CPU test |
| GET | `/api/workload/heavy` | High CPU test |

Workloads are intentionally synchronous so they raise CPU utilization. Set `WORKLOAD_MULTIPLIER` (for example `2`) on the server to tune their strength for your EC2 type. Do not run high load against a production system.

The infrastructure-metrics API is `GET /api/infrastructure-metrics`. It returns an honest `503` status until the deployed EC2 service has the required IAM role and AWS resource environment variables. See [aws/README.md](aws/README.md) for that setup.

See [aws/README.md](aws/README.md) for AWS setup and load-test instructions.
