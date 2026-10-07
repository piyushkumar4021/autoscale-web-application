import { Router } from 'express';
import { runWorkload } from '../controllers/workloadController.js';

const router = Router();
router.get('/:level', runWorkload);
export default router;
