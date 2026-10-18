import { useCallback, useEffect, useRef, useState } from "react";
import MetricCard from "../components/MetricCard.jsx";
import MetricLineChart from "../components/MetricLineChart.jsx";
import { api } from "../services/api.js";

const HISTORY_KEY = "autoscale-monitoring-history";
const MAX_HISTORY_SAMPLES = 30;

function readMetricHistory() {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(HISTORY_KEY));
    if (Array.isArray(saved?.cpu) && Array.isArray(saved?.requests)) {
      return {
        cpu: saved.cpu.slice(-MAX_HISTORY_SAMPLES),
        requests: saved.requests.slice(-MAX_HISTORY_SAMPLES),
      };
    }
  } catch {
    // A chart should never prevent the rest of the Performance Lab loading.
  }
  return { cpu: [], requests: [] };
}

function appendSample(series, sample) {
  if (series.some((point) => point.timestamp === sample.timestamp))
    return series;
  return [...series, sample].slice(-MAX_HISTORY_SAMPLES);
}

function InfrastructureMetrics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState(readMetricHistory);
  const refreshInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;

    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      setData(await api.infrastructureMetrics());
      setError(null);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
      setRefreshing(false);
      refreshInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
    const refreshTimer = window.setInterval(refresh, 5_000);
    return () => window.clearInterval(refreshTimer);
  }, [refresh]);

  useEffect(() => {
    const timestamp = data?.monitoringUpdatedAt;
    const cpu = data?.metrics?.averageCpuPercent;
    const requests = data?.metrics?.requestsLastMinute;
    if (!timestamp) return;

    setHistory((current) => {
      const nextCpu =
        typeof cpu === "number"
          ? appendSample(current.cpu, { timestamp, value: cpu })
          : current.cpu;
      const nextRequests =
        typeof requests === "number"
          ? appendSample(current.requests, { timestamp, value: requests })
          : current.requests;
      if (nextCpu === current.cpu && nextRequests === current.requests)
        return current;
      return { cpu: nextCpu, requests: nextRequests };
    });
  }, [data]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Session storage is optional; live chart rendering still works without it.
    }
  }, [history]);

  const metrics = data?.metrics;
  return (
    <section className="infrastructure-section">
      <div className="metrics-heading">
        <div>
          <p className="eyebrow">GOOGLE CLOUD INFRASTRUCTURE</p>
          <h2>Near real-time server load</h2>
        </div>
        <button
          className="button ghost"
          onClick={refresh}
          disabled={refreshing}
        >
          {loading
            ? "Loading..."
            : refreshing
              ? "Updating..."
              : "Refresh metrics"}
        </button>
      </div>
      {metrics ? (
        <>
          <div className="metric-grid infrastructure-grid">
            <MetricCard
              label="ACTIVE INSTANCES"
              value={metrics.activeInstances ?? "—"}
              detail="MIG instances serving"
              accent="green"
            />
            <MetricCard
              label="HEALTHY BACKENDS"
              value={metrics.healthyBackends ?? "—"}
              detail="Load balancer health check"
              accent="green"
            />
            <MetricCard
              label="MIG TARGET SIZE"
              value={metrics.targetSize ?? "—"}
              detail={
                metrics.pendingActions
                  ? `${metrics.pendingActions} action(s) pending`
                  : "No scaling action pending"
              }
              accent="purple"
            />
          </div>
          <div className="metric-chart-grid">
            <MetricLineChart
              label="CPU USAGE"
              detail="Compute Engine average"
              points={history.cpu}
              accent="orange"
              formatValue={(value) => `${value.toFixed(1)}%`}
            />
            <MetricLineChart
              label="REQUESTS / MIN"
              detail="Application Load Balancer"
              points={history.requests}
              accent="blue"
              formatValue={(value) => Math.round(value).toLocaleString()}
            />
          </div>
          {error && (
            <p className="error">
              Showing the last successful metrics. {error.message}
            </p>
          )}
          <p className="metrics-meta">
            Status checked: {new Date(data.updatedAt).toLocaleTimeString()} •
            CPU and request sample:{" "}
            {data.monitoringUpdatedAt
              ? new Date(data.monitoringUpdatedAt).toLocaleTimeString()
              : "unavailable"}
            {data.monitoringCached ? " (cached)" : ""}
          </p>
        </>
      ) : (
        <div className="metrics-unavailable">
          <span>☁</span>
          <div>
            <strong>Google Cloud infrastructure metrics are unavailable</strong>
            <p>{error?.message || "Checking Google Cloud configuration..."}</p>
            {error?.details?.detail && (
              <p>
                <code>{error.details.detail}</code>
              </p>
            )}
            {error?.details?.missingConfiguration && (
              <small>
                Set: {error.details.missingConfiguration.join(", ")}
              </small>
            )}
          </div>
        </div>
      )}
      <p className="metrics-note">
        Server health and MIG state refresh every 5 seconds. CPU and
        request-rate data refresh at most once per minute because Cloud
        Monitoring publishes those signals on minute-level intervals. Charts
        retain the latest 30 samples in this browser tab.
      </p>
    </section>
  );
}

export default function Performance() {
  return (
    <main className="container page">
      <p className="overline">CONTROLLED EXPERIMENT</p>
      <h1>Performance lab</h1>
      <p className="page-intro">
        Observe how your managed instances, CPU usage, and request volume react
        during a controlled k6 load test.
      </p>
      <InfrastructureMetrics />
    </main>
  );
}
