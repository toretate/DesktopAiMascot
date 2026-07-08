import { defineEventHandler, readBody, createError } from 'h3';
import { detectBaseFace } from '../../utils/expression-edit-service';

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        const { imagePath, detectMode } = body as { imagePath?: string; detectMode?: string };

        if (!imagePath) {
            throw createError({
                statusCode: 400,
                statusMessage: 'imagePath is required'
            });
        }

        console.log(`[Server] Detecting base face for image ${imagePath} with mode ${detectMode || 'ai'}`);
        const result = await detectBaseFace(imagePath, detectMode);

        return result;
    } catch (error: any) {
        console.error('[Server] detect-base-face failed:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
