import { useCallback, useEffect, useState } from "react";
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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.infrastructureMetrics());
      setError(null);
    } catch (requestError) {
      setData(null);
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const refreshTimer = window.setInterval(refresh, 20_000);
    return () => window.clearInterval(refreshTimer);
  }, [refresh]);

  const metrics = data?.metrics;
  return (
    <section className="infrastructure-section">
      <div className="metrics-heading">
        <div>
          <p className="eyebrow">AWS INFRASTRUCTURE</p>
          <h2>Near real-time server load</h2>
        </div>
        <button className="button ghost" onClick={refresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh metrics"}
        </button>
      </div>
      {metrics ? (
        <>
          <div className="metric-grid infrastructure-grid">
            <MetricCard label="ACTIVE INSTANCES" value={metrics.activeInstances ?? "—"} detail="ASG instances in service" accent="green" />
            <MetricCard label="AVERAGE CPU" value={metrics.averageCpuPercent === null ? "—" : `${metrics.averageCpuPercent.toFixed(1)}%`} detail="Auto Scaling Group average" accent="orange" />
            <MetricCard label="HEALTHY TARGETS" value={metrics.healthyTargets === null ? "—" : Math.round(metrics.healthyTargets)} detail="ALB target group" accent="green" />
            <MetricCard label="REQUESTS / TARGET" value={metrics.requestsPerTarget === null ? "—" : Math.round(metrics.requestsPerTarget)} detail="Last CloudWatch minute" />
            <MetricCard label="RESPONSE TIME" value={metrics.responseTimeMs === null ? "—" : `${metrics.responseTimeMs} ms`} detail="Average target response" accent="purple" />
          </div>
          <p className="metrics-meta">CloudWatch period: {data.periodSeconds} seconds • Last fetched: {new Date(data.updatedAt).toLocaleTimeString()}</p>
        </>
      ) : (
        <div className="metrics-unavailable">
          <span>☁</span>
          <div>
            <strong>AWS infrastructure metrics are unavailable</strong>
            <p>{error?.message || "Checking AWS configuration..."}</p>
            {error?.details?.missingConfiguration && <small>Set: {error.details.missingConfiguration.join(", ")}</small>}
          </div>
        </div>
      )}
      <p className="metrics-note">Refreshes every 20 seconds. CloudWatch publishes standard ALB and EC2 metrics in one-minute periods, so values are near real-time rather than second-by-second.</p>
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
          <p className="lab-footnote">The workload is deliberately CPU-intensive. Calibrate <code>WORKLOAD_MULTIPLIER</code> for your EC2 instance before a real stress test.</p>
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
