# Compute Engine service account roles

Attach a dedicated service account to the instance template. Assign these project-level roles:

- `roles/compute.viewer` — reads Managed Instance Group state and backend health.
- `roles/monitoring.viewer` — reads Compute Engine CPU and Application Load Balancer metrics.
- `roles/logging.logWriter` — optional; sends startup and application logs to Cloud Logging when configured.

Do not create or download a service-account JSON key. Code running on the VM uses the attached service account through Application Default Credentials.
