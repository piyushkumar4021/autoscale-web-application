import { Router } from 'express';
import { getInstance, getStatus, health } from '../controllers/systemController.js';

const router = Router();
router.get('/instance', getInstance);
router.get('/status', getStatus);
router.get('/health', health);
export default router;
