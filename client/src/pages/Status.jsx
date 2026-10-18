import MetricCard from '../components/MetricCard.jsx';

function duration(seconds = 0) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Status({ instance, uptimeSeconds, loading, error, refresh }) {
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
          <p>Google Cloud load-balancer health checks use <code>/health</code>, a minimal 200-response endpoint.</p>
        </div>
        <div className="server-identity">
          <small>CURRENT SERVER</small>
          <strong>{loading ? 'Locating…' : instance?.hostname || 'Unavailable'}</strong>
          <span>● Available</span>
        </div>
      </section>
      <section className="metric-grid">
        <MetricCard label="HOSTNAME" value={loading ? '—' : instance?.hostname || '—'} detail="Unique to this Compute Engine VM" />
        <MetricCard label="PROCESS UPTIME" value={loading || uptimeSeconds === null ? '—' : duration(uptimeSeconds)} detail="Current Node.js process" accent="orange" />
        <MetricCard label="NODE VERSION" value={instance?.nodeVersion || '—'} detail="Runtime environment" accent="purple" />
        <MetricCard label="PLATFORM" value={instance?.platform?.split(' ')[0] || '—'} detail={instance?.platform || 'Operating system'} accent="green" />
      </section>
      <p className="note">Tip: refresh this page through your Google Cloud load balancer to observe different VM hostnames as traffic is distributed.</p>
    </main>
  );
}
