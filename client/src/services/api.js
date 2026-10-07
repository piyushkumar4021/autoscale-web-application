async function request(path) {
  const response = await fetch(path);
  const data = await response.json();
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
