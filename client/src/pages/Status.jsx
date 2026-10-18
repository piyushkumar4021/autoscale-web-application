import { useEffect, useRef, useState } from 'react';
import MetricCard from '../components/MetricCard.jsx';
import { api } from '../services/api.js';

function duration(seconds = 0) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function isCurrentInstance(instanceName, hostname) {
  const currentName = hostname?.split('.')[0];
  return Boolean(instanceName && currentName) && instanceName.toLowerCase() === currentName.toLowerCase();
}

export default function Status({ instance, uptimeSeconds, loading, error, refresh }) {
  const [fleet, setFleet] = useState(null);
  const [fleetError, setFleetError] = useState('');
  const fleetRequestInFlight = useRef(false);

  useEffect(() => {
    let mounted = true;
    const refreshFleet = async () => {
      if (fleetRequestInFlight.current) return;

      fleetRequestInFlight.current = true;
      try {
        const nextFleet = await api.infrastructureMetrics();
        if (mounted) {
          setFleet(nextFleet);
          setFleetError('');
        }
      } catch (requestError) {
        if (mounted) setFleetError(requestError.message);
      } finally {
        fleetRequestInFlight.current = false;
      }
    };

    refreshFleet();
    const refreshTimer = window.setInterval(refreshFleet, 5_000);
    return () => {
      mounted = false;
      window.clearInterval(refreshTimer);
    };
  }, []);

  const instanceNames = fleet?.metrics?.activeInstanceNames || [];
  const currentHostname = instance?.hostname;

  return (
    <main className="container page">
      <div className="split-heading">
        <div>
          <p className="overline">LIVE ENVIRONMENT</p>
          <h1>System status</h1>
          <p className="page-intro">This information comes directly from the virtual machine that received your request.</p>
        </div>
        <button className="button ghost" onClick={refresh}>↻ Refresh</button>
      </div>
      {error && <p className="error">{error}</p>}
      <section className="status-hero">
        <div>
          <span className="healthy-mark">✓</span>
          <p className="eyebrow">APPLICATION</p>
          <h2>{loading ? 'Checking…' : 'Healthy & operational'}</h2>
          <p>Your request is being handled by a healthy Compute Engine instance.</p>
        </div>
      </section>
      <section className="instance-map" aria-live="polite">
        <div className="instance-map-heading">
          <div>
            <p className="eyebrow">MANAGED INSTANCE GROUP</p>
            <h2>{fleet ? `${fleet.metrics.activeInstances} active instance${fleet.metrics.activeInstances === 1 ? '' : 's'}` : 'Checking active instances…'}</h2>
          </div>
          <small>Refreshes every 5 seconds</small>
        </div>
        {instanceNames.length ? (
          <>
            <div className="instance-nodes">
              {instanceNames.map((name) => {
                const current = isCurrentInstance(name, currentHostname);
                return (
                  <article className={`instance-node ${current ? 'current' : ''}`} key={name}>
                    <span>{current ? 'CURRENT RESPONSE' : 'ACTIVE VM'}</span>
                    <strong>{name}</strong>
                  </article>
                );
              })}
            </div>
            <p className="served-by">Request served by <strong>{loading ? '…' : currentHostname || 'an available VM'}</strong></p>
          </>
        ) : (
          <p className="instance-map-empty">{fleetError || 'Waiting for the managed instance group to report its active VMs…'}</p>
        )}
      </section>
      <section className="metric-grid status-metric-grid">
        <MetricCard label="PROCESS UPTIME" value={loading || uptimeSeconds === null ? '—' : duration(uptimeSeconds)} detail="Current Node.js process" accent="orange" />
      </section>
    </main>
  );
}
