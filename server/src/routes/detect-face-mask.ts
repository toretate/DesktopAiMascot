import { Router } from 'express';
import { detectFaceMask } from '../services/face-mask-service.js';

const router = Router();

/**
 * POST /api/detect-face-mask
 *
 * Body:
 *   { imagePath: "/mascots/{mascotId}/expressions/expr_喜び.png" }
 *
 * Response (success):
 *   { success: true, mask: FaceMask, method: string }
 *
 * Response (error):
 *   { success: false, error: string }
 */
router.post('/detect-face-mask', async (req, res) => {
    try {
        const { imagePath } = req.body as { imagePath?: string };

        if (!imagePath) {
            return res.status(400).json({ success: false, error: 'imagePath is required' });
        }

        console.log(`[Server] Face mask detection request: ${imagePath}`);

        const result = await detectFaceMask(imagePath);

        console.log(`[Server] Face mask detected via ${result.method}: cx=${result.centerX} cy=${result.centerY}`);

        return res.json({ success: true, mask: result, method: result.method });
    } catch (error: any) {
        console.error('[Server] Face mask detection failed:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
