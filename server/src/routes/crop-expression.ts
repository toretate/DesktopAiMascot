import { Router } from 'express';
import { cropExpression } from '../services/crop-expression-service.js';

const router = Router();

/**
 * POST /api/crop-expression
 *
 * 表情スプライト画像から顔領域（目・口周辺）を検出してクロップする。
 * Python で MediaPipe → Haarcascade → BFS の順にフォールバックしながら検出する。
 *
 * Body:
 *   { imagePath: "/mascots/{mascotId}/expressions/expr_喜び.png" }
 *
 * Response (success):
 *   { success: true, croppedBase64: string, box: {top,left,bottom,right}, method: string }
 *   ※ croppedBase64 は data: プレフィックスなしの Base64。
 *   　 クライアントは "data:image/png;base64," + croppedBase64 で Data URL を構築する。
 *
 * Response (error):
 *   { success: false, error: string }
 */
router.post('/crop-expression', async (req, res) => {
    try {
        const { imagePath } = req.body as { imagePath?: string };

        if (!imagePath) {
            return res.status(400).json({ success: false, error: 'imagePath is required' });
        }

        console.log(`[Server] Crop expression request: ${imagePath}`);

        const result = await cropExpression(imagePath);

        console.log(`[Server] Expression cropped via ${result.method}: box=${JSON.stringify(result.box)}`);

        return res.json({
            success: true,
            croppedBase64: result.croppedBase64,
            box: result.box,
            method: result.method,
        });
    } catch (error: any) {
        console.error('[Server] Crop expression failed:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
