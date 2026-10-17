import { v1 as compute } from '@google-cloud/compute';
import { v3 as monitoring } from '@google-cloud/monitoring';

const requiredConfig = ['GCP_PROJECT_ID', 'GCP_ZONE', 'GCP_MIG_NAME', 'GCP_BACKEND_SERVICE'];

function latestPointValue(timeSeries) {
  const point = timeSeries?.[0]?.points?.[0]?.value;
  if (!point) return null;
  if (point.doubleValue !== undefined) return point.doubleValue;
  if (point.int64Value !== undefined) return Number(point.int64Value);
  return null;
}

function countActiveInstances(managedInstances) {
  return managedInstances.filter((instance) => instance.currentAction === 'NONE').length;
}

export async function getInfrastructureMetrics(_req, res, next) {
  const missing = requiredConfig.filter((name) => !process.env[name]);
  if (missing.length) {
    return res.status(503).json({
      available: false,
      provider: 'Google Cloud',
      message: 'Google Cloud metrics are not configured on this server.',
      missingConfiguration: missing
    });
  }

  try {
    const project = process.env.GCP_PROJECT_ID;
    const zone = process.env.GCP_ZONE;
    const migName = process.env.GCP_MIG_NAME;
    const backendService = process.env.GCP_BACKEND_SERVICE;
    const managersClient = new compute.InstanceGroupManagersClient();
    const backendsClient = new compute.BackendServicesClient();
    const monitoringClient = new monitoring.MetricServiceClient();

    const [[manager], [managedInstances]] = await Promise.all([
      managersClient.get({ project, zone, instanceGroupManager: migName }),
      managersClient.listManagedInstances({ project, zone, instanceGroupManager: migName })
    ]);

    const instanceIds = managedInstances.map((instance) => instance.id).filter(Boolean);
    const cpuFilter = instanceIds.length
      ? `metric.type = "compute.googleapis.com/instance/cpu/utilization" AND resource.type = "gce_instance" AND (${instanceIds.map((id) => `resource.labels.instance_id = "${id}"`).join(' OR ')})`
      : 'metric.type = "compute.googleapis.com/instance/cpu/utilization" AND resource.type = "gce_instance"';
    const projectName = monitoringClient.projectPath(project);
    const interval = {
      startTime: { seconds: Math.floor(Date.now() / 1000) - 10 * 60 },
      endTime: { seconds: Math.floor(Date.now() / 1000) }
    };

    const [backendHealth, cpuSeries, requestSeries] = await Promise.all([
      backendsClient.getHealth({
        project,
        backendService,
        resourceGroupReference: { group: manager.instanceGroup }
      }),
      monitoringClient.listTimeSeries({
        name: projectName,
        filter: cpuFilter,
        interval,
        aggregation: {
          alignmentPeriod: { seconds: 60 },
          perSeriesAligner: 'ALIGN_MEAN',
          crossSeriesReducer: 'REDUCE_MEAN'
        },
        view: 'FULL'
      }),
      monitoringClient.listTimeSeries({
        name: projectName,
        filter: `metric.type = "loadbalancing.googleapis.com/application_lb/backend_request_count" AND resource.type = "gce_backend_service" AND resource.labels.backend_service_name = "${backendService}"`,
        interval,
        aggregation: {
          alignmentPeriod: { seconds: 60 },
          perSeriesAligner: 'ALIGN_SUM',
          crossSeriesReducer: 'REDUCE_SUM'
        },
        view: 'FULL'
      })
    ]);

    const healthStatuses = backendHealth[0]?.healthStatus || [];
    const healthyBackends = healthStatuses.filter((status) => status.healthState === 'HEALTHY').length;
    const pendingActions = managedInstances.filter((instance) => instance.currentAction !== 'NONE').length;
    const averageCpuFraction = latestPointValue(cpuSeries[0]);
    res.json({
      available: true,
      provider: 'Google Cloud',
      updatedAt: new Date().toISOString(),
      periodSeconds: 60,
      metrics: {
        activeInstances: countActiveInstances(managedInstances),
        targetSize: Number(manager.targetSize || 0),
        averageCpuPercent: averageCpuFraction === null ? null : averageCpuFraction * 100,
        healthyBackends,
        requestsLastMinute: latestPointValue(requestSeries[0]),
        pendingActions
      }
    });
  } catch (error) {
    // IAM / auth errors — service account missing roles
    if (error.code === 7 || error.code === 16 || error.code === 403) {
      return res.status(503).json({
        available: false,
        provider: 'Google Cloud',
        message: 'The VM service account cannot read Compute Engine or Cloud Monitoring data. Check its IAM roles and API access.',
        detail: error.message
      });
    }
    // All other GCP / network errors — return structured 503 instead of generic 500
    console.error('[metricsController] Unhandled error fetching GCP metrics:', error);
    return res.status(503).json({
      available: false,
      provider: 'Google Cloud',
      message: 'Failed to fetch Google Cloud metrics.',
      detail: error.message
    });
  }
}
