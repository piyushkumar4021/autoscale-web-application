import { v1 as compute } from '@google-cloud/compute';
import { v3 as monitoring } from '@google-cloud/monitoring';

const requiredConfig = ['GCP_PROJECT_ID', 'GCP_ZONE', 'GCP_MIG_NAME', 'GCP_BACKEND_SERVICE'];

// Hard deadline so GCP calls never hang long enough for the ALB to cut the
// connection and return plain-text "upstream request timeout" instead of JSON.
const GCP_TIMEOUT_MS = 20_000;
const MONITORING_CACHE_TTL_MS = 60_000;

// CPU and load-balancer Monitoring series are minute-level signals. Keep one
// snapshot so a responsive browser poll does not issue the same expensive
// Monitoring query every few seconds.
let monitoringSnapshotCache = {
  key: null,
  expiresAt: 0,
  snapshot: null,
  pending: null
};

function rejectAfter(ms, label) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(Object.assign(new Error(`GCP API timed out after ${ms / 1000}s (${label})`), { code: 'TIMEOUT' })), ms)
  );
}

function latestPointValue(timeSeries) {
  const point = timeSeries?.[0]?.points?.[0]?.value;
  if (!point) return null;
  if (point.doubleValue !== undefined) return point.doubleValue;
  if (point.int64Value !== undefined) return Number(point.int64Value);
  return null;
}

function managedInstanceName(instance) {
  return instance.instance?.split('/').pop() || null;
}

function optionalMetric(metricName, request) {
  return request.catch((error) => {
    // Cloud Monitoring metric families and their rollout timing vary by load
    // balancer type. One optional chart must not hide the MIG, CPU, and health
    // data that are otherwise available.
    console.warn(`[metricsController] ${metricName} is unavailable: ${error.message}`);
    return [];
  });
}

async function getCachedMonitoringSnapshot(cacheKey, loadSnapshot) {
  const now = Date.now();
  if (
    monitoringSnapshotCache.key === cacheKey &&
    monitoringSnapshotCache.snapshot &&
    monitoringSnapshotCache.expiresAt > now
  ) {
    return { ...monitoringSnapshotCache.snapshot, cached: true };
  }

  if (monitoringSnapshotCache.key === cacheKey && monitoringSnapshotCache.pending) {
    return monitoringSnapshotCache.pending;
  }

  const pending = loadSnapshot()
    .then((snapshot) => {
      if (
        monitoringSnapshotCache.key === cacheKey &&
        monitoringSnapshotCache.pending === pending
      ) {
        monitoringSnapshotCache = {
          key: cacheKey,
          expiresAt: Date.now() + MONITORING_CACHE_TTL_MS,
          snapshot,
          pending: null
        };
      }
      return { ...snapshot, cached: false };
    })
    .catch((error) => {
      if (
        monitoringSnapshotCache.key === cacheKey &&
        monitoringSnapshotCache.pending === pending
      ) {
        monitoringSnapshotCache.pending = null;
      }
      throw error;
    });

  monitoringSnapshotCache = {
    key: cacheKey,
    expiresAt: 0,
    snapshot: null,
    pending
  };
  return pending;
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

    // Stage 1: fetch MIG state — race against the global deadline
    const [[manager], [managedInstances], [backend]] = await Promise.race([
      Promise.all([
        managersClient.get({ project, zone, instanceGroupManager: migName }),
        managersClient.listManagedInstances({ project, zone, instanceGroupManager: migName }),
        backendsClient.get({ project, backendService })
      ]),
      rejectAfter(GCP_TIMEOUT_MS, 'MIG fetch')
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
    // gce_backend_service has backend_service_id, not backend_service_name.
    // Cloud Monitoring rejects a filter with a label that does not exist on the
    // monitored-resource descriptor instead of returning an empty series.
    const backendServiceId = String(backend.id);
    const instanceGroup = manager.instanceGroup;
    if (!instanceGroup) {
      throw new Error(`Managed instance group "${migName}" did not return its instance-group URL.`);
    }
    const requestFilter = `metric.type = "loadbalancing.googleapis.com/application_lb/backend_request_count" AND resource.type = "gce_backend_service" AND resource.labels.backend_service_id = "${backendServiceId}"`;

    const monitoringCacheKey = [
      project,
      backendServiceId,
      [...instanceIds].sort().join(',')
    ].join(':');

    // Stage 2: health and MIG state are queried for each request. Monitoring
    // data is cached because its source data changes much more slowly than the
    // browser polling interval.
    const [backendHealth, monitoringSnapshot] = await Promise.race([
      Promise.all([
        backendsClient.getHealth({
          project,
          backendService,
          // The generated SDK uses this name for the JSON request body.
          // `resourceGroupReference` is ignored and sends an empty body.
          resourceGroupReferenceResource: { group: instanceGroup }
        }),
        getCachedMonitoringSnapshot(monitoringCacheKey, async () => {
          const [cpuSeries, requestSeries] = await Promise.all([
            optionalMetric('Compute Engine CPU metric', monitoringClient.listTimeSeries({
              name: projectName,
              filter: cpuFilter,
              interval,
              aggregation: {
                alignmentPeriod: { seconds: 60 },
                perSeriesAligner: 'ALIGN_MEAN',
                crossSeriesReducer: 'REDUCE_MEAN'
              },
              view: 'FULL'
            })),
            optionalMetric('load-balancer request metric', monitoringClient.listTimeSeries({
              name: projectName,
              filter: requestFilter,
              interval,
              aggregation: {
                alignmentPeriod: { seconds: 60 },
                perSeriesAligner: 'ALIGN_SUM',
                crossSeriesReducer: 'REDUCE_SUM'
              },
              view: 'FULL'
            }))
          ]);

          return {
            averageCpuFraction: latestPointValue(cpuSeries[0]),
            requestsLastMinute: latestPointValue(requestSeries[0]),
            updatedAt: new Date().toISOString()
          };
        })
      ]),
      rejectAfter(GCP_TIMEOUT_MS, 'metrics fetch')
    ]);

    const activeManagedInstances = managedInstances.filter((instance) => instance.currentAction === 'NONE');
    const healthStatuses = backendHealth[0]?.healthStatus || [];
    const healthyBackends = healthStatuses.filter((status) => status.healthState === 'HEALTHY').length;
    const pendingActions = managedInstances.filter((instance) => instance.currentAction !== 'NONE').length;
    res.json({
      available: true,
      provider: 'Google Cloud',
      updatedAt: new Date().toISOString(),
      monitoringUpdatedAt: monitoringSnapshot.updatedAt,
      monitoringCached: monitoringSnapshot.cached,
      periodSeconds: 60,
      metrics: {
        activeInstances: activeManagedInstances.length,
        activeInstanceNames: activeManagedInstances
          .map(managedInstanceName)
          .filter(Boolean),
        targetSize: Number(manager.targetSize || 0),
        averageCpuPercent: monitoringSnapshot.averageCpuFraction === null
          ? null
          : monitoringSnapshot.averageCpuFraction * 100,
        healthyBackends,
        requestsLastMinute: monitoringSnapshot.requestsLastMinute,
        pendingActions
      }
    });
  } catch (error) {
    // Hard timeout — GCP APIs took too long; return clean JSON before the ALB cuts us off
    if (error.code === 'TIMEOUT') {
      console.warn('[metricsController] GCP API timeout:', error.message);
      return res.status(503).json({
        available: false,
        provider: 'Google Cloud',
        message: 'Google Cloud APIs did not respond in time. Try again in a moment.',
        detail: error.message
      });
    }
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
