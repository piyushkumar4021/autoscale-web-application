import { AutoScalingClient, DescribeAutoScalingGroupsCommand } from '@aws-sdk/client-auto-scaling';
import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const requiredConfig = ['AWS_REGION', 'AUTO_SCALING_GROUP_NAME', 'ALB_ARN', 'TARGET_GROUP_ARN'];

function resourceDimension(arn) {
  return arn.split(':').at(-1);
}

function currentValue(results, id) {
  return results.find((result) => result.Id === id)?.Values?.[0] ?? null;
}

function metric(id, metricName, dimensions, stat) {
  return {
    Id: id,
    ReturnData: true,
    MetricStat: {
      Metric: { Namespace: 'AWS/ApplicationELB', MetricName: metricName, Dimensions: dimensions },
      Period: 60,
      Stat: stat
    }
  };
}

export async function getInfrastructureMetrics(_req, res, next) {
  const missing = requiredConfig.filter((name) => !process.env[name]);
  if (missing.length) {
    return res.status(503).json({
      available: false,
      message: 'AWS metrics are not configured on this server.',
      missingConfiguration: missing
    });
  }

  try {
    const region = process.env.AWS_REGION;
    const groupName = process.env.AUTO_SCALING_GROUP_NAME;
    const dimensions = [
      { Name: 'LoadBalancer', Value: resourceDimension(process.env.ALB_ARN) },
      { Name: 'TargetGroup', Value: resourceDimension(process.env.TARGET_GROUP_ARN) }
    ];
    const [groupResponse, metricsResponse] = await Promise.all([
      new AutoScalingClient({ region }).send(new DescribeAutoScalingGroupsCommand({ AutoScalingGroupNames: [groupName] })),
      new CloudWatchClient({ region }).send(new GetMetricDataCommand({
        StartTime: new Date(Date.now() - 5 * 60 * 1000),
        EndTime: new Date(),
        ScanBy: 'TimestampDescending',
        MetricDataQueries: [
          {
            Id: 'average_cpu',
            ReturnData: true,
            MetricStat: {
              Metric: {
                Namespace: 'AWS/EC2',
                MetricName: 'CPUUtilization',
                Dimensions: [{ Name: 'AutoScalingGroupName', Value: groupName }]
              },
              Period: 60,
              Stat: 'Average'
            }
          },
          metric('healthy_targets', 'HealthyHostCount', dimensions, 'Average'),
          metric('requests_per_target', 'RequestCountPerTarget', dimensions, 'Sum'),
          metric('response_time', 'TargetResponseTime', dimensions, 'Average')
        ]
      }))
    ]);

    const group = groupResponse.AutoScalingGroups?.[0];
    if (!group) return res.status(404).json({ available: false, message: `Auto Scaling Group "${groupName}" was not found.` });

    const activeInstances = (group.Instances || []).filter((instance) => instance.LifecycleState === 'InService').length;
    const values = metricsResponse.MetricDataResults || [];
    res.json({
      available: true,
      updatedAt: new Date().toISOString(),
      periodSeconds: 60,
      metrics: {
        activeInstances,
        averageCpuPercent: currentValue(values, 'average_cpu'),
        healthyTargets: currentValue(values, 'healthy_targets'),
        requestsPerTarget: currentValue(values, 'requests_per_target'),
        responseTimeMs: currentValue(values, 'response_time') === null ? null : Math.round(currentValue(values, 'response_time') * 1000)
      }
    });
  } catch (error) {
    if (error.name === 'CredentialsProviderError' || error.name === 'AccessDeniedException') {
      return res.status(503).json({ available: false, message: 'The EC2 IAM role cannot read AWS metrics. Check its permissions.' });
    }
    next(error);
  }
}
