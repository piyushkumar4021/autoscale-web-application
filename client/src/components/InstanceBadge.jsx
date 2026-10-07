export default function InstanceBadge({ hostname, loading = false }) {
  return <div className="instance-badge"><span className="pulse" /><div><small>REQUEST SERVED BY</small><strong>{loading ? 'Locating instance…' : hostname || 'Unavailable'}</strong></div></div>;
}
