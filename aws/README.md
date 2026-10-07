# AWS deployment notes

1. Build and test the project locally first.
2. Push it to GitHub, then replace `REPOSITORY_URL` in `user-data.sh`.
3. Create a launch template using Amazon Linux 2023 and use the script as user data.
4. Create a target group on port `3000` with health-check path `/health`.
5. Create an internet-facing Application Load Balancer, listener port `80`, forwarding to that target group.
6. Create an Auto Scaling Group from the launch template: minimum `1`, desired `1`, maximum `4`.
7. Add target tracking. For the first demo use average ASG CPU utilization with a target around `50%`.
8. Allow the ALB security group to accept HTTP 80. Allow the instance security group to accept port 3000 only from the ALB security group.

## Performance Lab infrastructure metrics

The Performance Lab reads AWS data only from the Express backend. It never exposes AWS credentials to the React app.

Attach the IAM policy in [autoscale-metrics-policy.json](autoscale-metrics-policy.json) to the EC2 instance role, then configure these system environment variables for the Node service:

```text
AWS_REGION=ap-south-1
AUTO_SCALING_GROUP_NAME=your-auto-scaling-group-name
ALB_ARN=arn:aws:elasticloadbalancing:REGION:ACCOUNT:loadbalancer/app/NAME/ID
TARGET_GROUP_ARN=arn:aws:elasticloadbalancing:REGION:ACCOUNT:targetgroup/NAME/ID
```

After changing the systemd environment, run `sudo systemctl daemon-reload` and `sudo systemctl restart autoscale`.

The dashboard refreshes every 20 seconds. CloudWatch ALB and standard EC2 metrics are one-minute measurements, so the dashboard is intentionally labelled **near real-time**. It displays active ASG instances, average CPU, healthy targets, requests per target, and average target response time.

Enable **detailed monitoring** in the launch template if you want one-minute EC2 CPU data. Without it, EC2 basic monitoring can publish CPU data in five-minute intervals.

Run a test from a separate machine:

```bash
k6 run -e BASE_URL=http://YOUR-ALB-DNS load-test/heavy.js
```

Observe CPUUtilization, HealthyHostCount, RequestCountPerTarget, and TargetResponseTime in CloudWatch. Tune `WORKLOAD_MULTIPLIER` or k6 virtual users for your selected instance type.
