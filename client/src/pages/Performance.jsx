import { useCallback, useEffect, useRef, useState } from "react";
import InstanceBadge from "../components/InstanceBadge.jsx";
import MetricCard from "../components/MetricCard.jsx";
import { api } from "../services/api.js";

const levels = [
  { key: "light", title: "Light", detail: "Quick CPU sample", tone: "green" },
  { key: "medium", title: "Medium", detail: "Sustained compute", tone: "orange" },
  { key: "heavy", title: "Heavy", detail: "Peak traffic test", tone: "red" },
];

function InfrastructureMetrics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const metrics = data?.metrics;
  return (
    <section className="infrastructure-section">
      <div className="metrics-heading">
        <div>
          <p className="eyebrow">GOOGLE CLOUD INFRASTRUCTURE</p>
          <h2>Near real-time server load</h2>
        </div>
        <button className="button ghost" onClick={refresh} disabled={refreshing}>
          {loading ? "Loading..." : refreshing ? "Updating..." : "Refresh metrics"}
        </button>
      </div>
      {metrics ? (
        <>
          <div className="metric-grid infrastructure-grid">
            <MetricCard label="ACTIVE INSTANCES" value={metrics.activeInstances ?? "—"} detail="MIG instances serving" accent="green" />
            <MetricCard label="AVERAGE CPU" value={metrics.averageCpuPercent === null ? "—" : `${metrics.averageCpuPercent.toFixed(1)}%`} detail="Compute Engine average" accent="orange" />
            <MetricCard label="HEALTHY BACKENDS" value={metrics.healthyBackends ?? "—"} detail="Load balancer health check" accent="green" />
            <MetricCard label="REQUESTS / MIN" value={metrics.requestsLastMinute === null ? "—" : Math.round(metrics.requestsLastMinute)} detail="Last Monitoring minute" />
            <MetricCard label="MIG TARGET SIZE" value={metrics.targetSize ?? "—"} detail={metrics.pendingActions ? `${metrics.pendingActions} action(s) pending` : "No scaling action pending"} accent="purple" />
          </div>
          {error && <p className="error">Showing the last successful metrics. {error.message}</p>}
          <p className="metrics-meta">Status checked: {new Date(data.updatedAt).toLocaleTimeString()} • CPU and request sample: {data.monitoringUpdatedAt ? new Date(data.monitoringUpdatedAt).toLocaleTimeString() : "unavailable"}{data.monitoringCached ? " (cached)" : ""}</p>
        </>
      ) : (
        <div className="metrics-unavailable">
          <span>☁</span>
          <div>
            <strong>Google Cloud infrastructure metrics are unavailable</strong>
            <p>{error?.message || "Checking Google Cloud configuration..."}</p>
            {error?.details?.detail && <p><code>{error.details.detail}</code></p>}
            {error?.details?.missingConfiguration && <small>Set: {error.details.missingConfiguration.join(", ")}</small>}
          </div>
        </div>
      )}
      <p className="metrics-note">Server health and MIG state refresh every 5 seconds. CPU and request-rate data refresh at most once per minute because Cloud Monitoring publishes those signals on minute-level intervals.</p>
    </section>
  );
}

export default function Performance({ instance }) {
  const [active, setActive] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function run(level) {
    setActive(level);
    setError("");
    setResult(null);
    try {
      setResult(await api.workload(level));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setActive("");
    }
  }

  return (
    <main className="container page">
      <p className="overline">CONTROLLED EXPERIMENT</p>
      <h1>Performance lab</h1>
      <p className="page-intro">Generate intentional CPU work, then use k6 to repeat it at scale. The API reports exactly which server completed each job.</p>
      <InfrastructureMetrics />
      <section className="lab-layout">
        <div className="workload-panel">
          <div className="panel-heading"><div><p className="eyebrow">SELECT WORKLOAD</p><h2>Test the application</h2></div><InstanceBadge hostname={instance?.hostname} /></div>
          <div className="workload-options">
            {levels.map((level) => <button key={level.key} className={`workload-option ${level.tone} ${active === level.key ? "running" : ""}`} disabled={Boolean(active)} onClick={() => run(level.key)}><span className="workload-symbol">{level.key === "light" ? "◔" : level.key === "medium" ? "◑" : "●"}</span><b>{active === level.key ? "Running..." : level.title}</b><small>{level.detail}</small><i>→</i></button>)}
          </div>
          <p className="lab-footnote">The workload is deliberately CPU-intensive. Calibrate <code>WORKLOAD_MULTIPLIER</code> for your Compute Engine machine type before a real stress test.</p>
        </div>
        <div className="result-panel">
          <p className="eyebrow">LAST RESULT</p>
          {error && <p className="error">{error}</p>}
          {!result && !error ? <div className="empty-result"><span>⌁</span><p>Select a workload level to begin.</p><small>Results will appear here after the server finishes.</small></div> : result && <><div className="result-status"><span>✓</span><div><strong>Workload completed</strong><small>{result.workload} computation</small></div></div><dl><div><dt>Processing time</dt><dd>{result.processingTimeMs.toLocaleString()} ms</dd></div><div><dt>Serving instance</dt><dd>{result.server}</dd></div><div><dt>Iterations</dt><dd>{result.iterations.toLocaleString()}</dd></div></dl><div className="result-bar"><span style={{ width: `${Math.min(100, 18 + result.processingTimeMs / 8)}%` }} /></div></>}
        </div>
      </section>
    </main>
  );
}
