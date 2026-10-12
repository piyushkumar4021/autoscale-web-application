# Google Cloud deployment notes

This project is deployed to a **zonal Managed Instance Group (MIG)** behind an external **Application Load Balancer**. This keeps the project simple and cost-conscious while still demonstrating health checks, load distribution, CPU autoscaling, scale-out, and scale-in.

## Cost guardrails

1. In **Billing**, verify your remaining credit and create a small budget alert before creating resources.
2. Use one small Compute Engine machine type and set the MIG to `min=1`, `max=3`.
3. Do not create Cloud NAT, Cloud SQL, static external VM IP addresses, or a custom domain for this project.
4. Delete the forwarding rule, load balancer resources, MIG, instance template, and firewall rules after the demo.

## APIs to enable

In **APIs & Services → Library**, enable:

- Compute Engine API
- Cloud Monitoring API

## Deployment configuration

1. Create the service account and assign the roles in [service-account-roles.md](service-account-roles.md).
2. Create a health check: HTTP, port `3000`, request path `/health`.
3. Create a backend service named `autoscale-backend`. Attach the health check later when the MIG exists.
4. Edit [startup-script.sh](startup-script.sh) with your public GitHub repository URL, GCP project ID, zone, MIG name, and backend-service name.
5. Create an instance template using Debian 12, a small machine type, the dedicated service account, **Allow full access to all Cloud APIs** access scope, and the edited startup script. The IAM roles still limit what the VM can access.
6. Create a **zonal** Managed Instance Group named `autoscale-mig`, initial size `1`, from that template. Set its named port to `http:3000`.
7. Add the MIG as a backend to `autoscale-backend`, using named port `http`, balancing mode `UTILIZATION`, and a target utilization around `0.8`.
8. Create the external Application Load Balancer resources: URL map → target HTTP proxy → global IPv4 forwarding rule on port `80`, pointing to `autoscale-backend`.
9. Create firewall rule `allow-lb-health-checks`: permit TCP `3000` from `130.211.0.0/22` and `35.191.0.0/16`, targeting the network tag on your VMs. Create a second ingress rule permitting TCP `3000` from the load-balancer proxy-only subnet when required by the selected load-balancer mode.
10. Add a MIG autoscaling policy based on average CPU target `0.50`, minimum `1`, maximum `3`, with a 180-second initialization period.

## Performance Lab metrics

The Express backend uses the VM's attached service account and Application Default Credentials. It requires these system environment variables, already present in the startup-script template:

```text
GCP_PROJECT_ID=your-project-id
GCP_ZONE=asia-south1-a
GCP_MIG_NAME=autoscale-mig
GCP_BACKEND_SERVICE=autoscale-backend
```

It returns active MIG instances, the group target size, healthy load-balancer backends, average Compute Engine CPU, pending MIG actions, and recent Application Load Balancer requests.

Cloud Monitoring metrics are not instantaneous. Compute Engine samples CPU every 60 seconds and load-balancer metric availability can lag by several minutes. The Performance Lab therefore labels the display **near real-time**.

## Load test

After the backend is healthy, use the forwarding rule IP address:

```bash
k6 run -e BASE_URL=http://YOUR_LOAD_BALANCER_IP load-test/light.js
k6 run -e BASE_URL=http://YOUR_LOAD_BALANCER_IP load-test/medium.js
```

Run the heavy test only briefly and monitor cost and CPU. Do not run k6 from a VM in the same MIG.

## Cleanup

To stop charges after the demonstration, delete the forwarding rule, target proxy, URL map, backend service, health check, MIG, instance template, and temporary firewall rules. Confirm in Billing that no Compute Engine VMs or load-balancer forwarding rules remain.
