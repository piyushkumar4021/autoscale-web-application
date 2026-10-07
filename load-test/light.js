import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = { vus: 10, duration: '1m' };
const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';
export default function () {
  const response = http.get(`${baseUrl}/api/workload/light`);
  check(response, { 'completed': (r) => r.status === 200 });
  sleep(1);
}
