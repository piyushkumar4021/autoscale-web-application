import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = { vus: 100, duration: '5m' };
const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';
export default function () {
  const response = http.get(`${baseUrl}/api/workload/heavy`);
  check(response, { 'completed': (r) => r.status === 200 });
  sleep(1);
}
