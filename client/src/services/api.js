async function request(path) {
  const response = await fetch(path);

  // Read as text first — if the load balancer / proxy returns a plain-text error
  // (e.g. "upstream request timeout"), response.json() would crash with an opaque
  // "Unexpected token …" message. Parsing manually gives us a legible fallback.
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // Body is not JSON — surface the raw text (truncated) as the error message
    throw new Error(text.slice(0, 300) || `Server error (${response.status})`);
  }

  if (!response.ok) {
    const error = new Error(data.error || data.message || 'Request failed');
    error.details = data;
    throw error;
  }
  return data;
}

export const api = {
  instance: () => request('/api/instance'),
  status: () => request('/api/status'),
  infrastructureMetrics: () => request('/api/infrastructure-metrics'),
  workload: (level) => request(`/api/workload/${level}`)
};
