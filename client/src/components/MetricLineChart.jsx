const VIEWBOX_WIDTH = 520;
const VIEWBOX_HEIGHT = 170;
const PADDING = { top: 14, right: 14, bottom: 18, left: 14 };

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MetricLineChart({ label, detail, points, accent, formatValue }) {
  const values = points.map((point) => point.value);
  const hasPoints = values.length > 0;
  const minimum = hasPoints ? Math.min(...values) : 0;
  const maximum = hasPoints ? Math.max(...values) : 0;
  const spread = maximum - minimum;
  const lowerBound = Math.max(0, spread ? minimum - spread * 0.15 : minimum * 0.85);
  const upperBound = spread ? maximum + spread * 0.15 : Math.max(maximum * 1.15, 1);
  const usableWidth = VIEWBOX_WIDTH - PADDING.left - PADDING.right;
  const usableHeight = VIEWBOX_HEIGHT - PADDING.top - PADDING.bottom;
  const baseline = VIEWBOX_HEIGHT - PADDING.bottom;
  const range = Math.max(upperBound - lowerBound, 1);
  const coordinates = points.map((point, index) => {
    const x = points.length === 1
      ? PADDING.left + usableWidth / 2
      : PADDING.left + (index / (points.length - 1)) * usableWidth;
    const y = PADDING.top + ((upperBound - point.value) / range) * usableHeight;
    return { x, y };
  });
  const linePath = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const areaPath = coordinates.length
    ? `M ${coordinates[0].x},${baseline} L ${coordinates.map(({ x, y }) => `${x},${y}`).join(" L ")} L ${coordinates.at(-1).x},${baseline} Z`
    : "";
  const latestValue = hasPoints ? values.at(-1) : null;
  const gradientId = `metric-chart-gradient-${accent}`;

  return (
    <article className={`metric-chart ${accent}`}>
      <div className="metric-chart-heading">
        <div>
          <p>{label}</p>
          <strong>{latestValue === null ? "—" : formatValue(latestValue)}</strong>
        </div>
        <small>{detail}</small>
      </div>
      {hasPoints ? (
        <>
          <div className="metric-chart-canvas">
            <span className="metric-chart-max">{formatValue(upperBound)}</span>
            <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} role="img" aria-label={`${label} trend chart`} preserveAspectRatio="none">
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.34" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((position) => (
                <line
                  key={position}
                  x1={PADDING.left}
                  x2={VIEWBOX_WIDTH - PADDING.right}
                  y1={PADDING.top + usableHeight * position}
                  y2={PADDING.top + usableHeight * position}
                  className="metric-chart-gridline"
                />
              ))}
              <path d={areaPath} fill={`url(#${gradientId})`} />
              <polyline points={linePath} className="metric-chart-line" />
              {coordinates.map(({ x, y }, index) => (
                <circle key={`${points[index].timestamp}-${index}`} cx={x} cy={y} r="3" className="metric-chart-point" />
              ))}
            </svg>
            <span className="metric-chart-min">{formatValue(lowerBound)}</span>
          </div>
          <div className="metric-chart-axis">
            <span>{formatTime(points[0].timestamp)}</span>
            <span>{points.length} sample{points.length === 1 ? "" : "s"}</span>
            <span>{formatTime(points.at(-1).timestamp)}</span>
          </div>
        </>
      ) : (
        <div className="metric-chart-empty">Waiting for the first Cloud Monitoring sample…</div>
      )}
    </article>
  );
}
