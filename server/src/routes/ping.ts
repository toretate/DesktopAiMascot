import { Router } from 'express';

const router = Router();

router.get('/ping', (req, res) => {
    console.log('[Server] Ping request received');
    res.json({
        success: true,
        message: 'pong',
        timestamp: new Date().toISOString()
    });
});

export default router;
