export default function MetricCard({ label, value, detail, accent = 'blue' }) {
  return <article className={`metric-card ${accent}`}><p>{label}</p><strong>{value}</strong>{detail && <small>{detail}</small>}</article>;
}
