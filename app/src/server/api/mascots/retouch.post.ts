import { defineEventHandler, readBody, createError } from 'h3';
import { applyRetouch } from '../../utils/expression-edit-service';

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        const { imagePath, tool, x, y, radius } = body as {
            imagePath?: string;
            tool?: 'brush' | 'eraser';
            x?: number;
            y?: number;
            radius?: number;
        };

        if (!imagePath || !tool || x === undefined || y === undefined || radius === undefined) {
            throw createError({
                statusCode: 400,
                statusMessage: 'imagePath, tool, x, y, and radius are required'
            });
        }

        console.log(`[Server] Applying retouch tool=${tool} at (${x}, ${y}) r=${radius} on ${imagePath}`);
        // 画像を上書き保存
        const resultPath = await applyRetouch(imagePath, imagePath, tool, x, y, radius);

        return { success: true, path: resultPath };
    } catch (error: any) {
        console.error('[Server] retouch failed:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
