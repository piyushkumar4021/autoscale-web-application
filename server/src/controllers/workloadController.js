import os from 'node:os';

// Tune WORKLOAD_MULTIPLIER on the EC2 instance if a different CPU profile is needed.
const multiplier = Math.max(0.1, Number(process.env.WORKLOAD_MULTIPLIER || 1));
const workloads = { light: 1_500_000, medium: 7_500_000, heavy: 25_000_000 };

function calculate(iterations) {
  let result = 0;
  for (let index = 0; index < iterations; index += 1) {
    result += Math.sqrt(index) * Math.sin(index % 360);
  }
  return Number(result.toFixed(2));
}

export function runWorkload(req, res) {
  const level = req.params.level;
  const baseline = workloads[level];
  if (!baseline) return res.status(400).json({ error: 'Invalid workload level. Choose light, medium, or heavy.' });

  const iterations = Math.floor(baseline * multiplier);
  const start = performance.now();
  const result = calculate(iterations);
  const processingTimeMs = Math.round(performance.now() - start);
  res.json({
    message: 'Workload completed',
    workload: level,
    iterations,
    processingTimeMs,
    server: os.hostname(),
    result
  });
}
