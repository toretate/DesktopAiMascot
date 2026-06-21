import { defineEventHandler, readBody, createError } from 'h3';
import { detectFaceMask } from '../utils/face-mask-service';

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        const { imagePath } = body as { imagePath?: string };

        if (!imagePath) {
            throw createError({
                statusCode: 400,
                statusMessage: 'imagePath is required'
            });
        }

        console.log(`[Server] Face mask detection request: ${imagePath}`);

        const result = await detectFaceMask(imagePath);

        console.log(`[Server] Face mask detected via ${result.method}: cx=${result.centerX} cy=${result.centerY}`);

        return { success: true, mask: result, method: result.method };
    } catch (error: any) {
        console.error('[Server] Face mask detection failed:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
