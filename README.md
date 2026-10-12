# AutoScale — Dynamic Web Application for Peak Traffic Management

A complete college cloud-computing project application demonstrating a stateless React and Node.js service designed for Google Cloud external Application Load Balancing and Compute Engine Managed Instance Groups.

## Included features

- React interface with Home, System Status, Performance Lab, and About views
- Express APIs: `/health`, `/api/instance`, `/api/status`, and `/api/workload/:level`
- A lightweight Google Cloud load-balancer-compatible health endpoint
- Controlled `light`, `medium`, and `heavy` CPU workloads that identify the serving host
- Performance Lab cards for active VM instances, average CPU, healthy backends, request rate, and target capacity after Google Cloud configuration
- k6 tests and a Compute Engine startup-script template

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

Open `http://localhost:3000`; Express serves the built React frontend and API together, matching the intended Compute Engine deployment model.

## API reference

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/health` | Lightweight target-group health check |
| GET | `/api/instance` | VM hostname, uptime, platform, Node version |
| GET | `/api/status` | Application health and instance details |
| GET | `/api/workload/light` | Low CPU test |
| GET | `/api/workload/medium` | Medium CPU test |
| GET | `/api/workload/heavy` | High CPU test |

Workloads are intentionally synchronous so they raise CPU utilization. Set `WORKLOAD_MULTIPLIER` (for example `2`) on the server to tune their strength for your Compute Engine machine type. Do not run high load against a production system.

The infrastructure-metrics API is `GET /api/infrastructure-metrics`. It returns an honest `503` status until the deployed Compute Engine service has the required service account and Google Cloud environment variables. See [gcp/README.md](gcp/README.md) for that setup.

See [gcp/README.md](gcp/README.md) for Google Cloud setup and load-test instructions.
