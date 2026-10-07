import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import systemRoutes from './routes/systemRoutes.js';
import workloadRoutes from './routes/workloadRoutes.js';
import metricsRoutes from './routes/metricsRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(currentDirectory, '../../client/dist');

app.disable('x-powered-by');
app.use(express.json());
app.get('/health', (req, res) => res.status(200).json({ status: 'healthy' }));
app.use('/api', systemRoutes);
app.use('/api/workload', workloadRoutes);
app.use('/api/infrastructure-metrics', metricsRoutes);

app.use(express.static(clientDist));
app.get('/{*path}', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (error) => error && next(error));
});
app.use(notFound);
app.use(errorHandler);

export default app;
