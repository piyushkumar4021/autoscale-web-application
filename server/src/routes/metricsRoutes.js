import { Router } from 'express';
import { getInfrastructureMetrics } from '../controllers/metricsController.js';

const router = Router();
router.get('/', getInfrastructureMetrics);
export default router;
