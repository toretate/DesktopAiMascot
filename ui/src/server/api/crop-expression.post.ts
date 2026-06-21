import { defineEventHandler, readBody, createError } from 'h3';
import { cropExpression } from '../utils/crop-expression-service';

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

        console.log(`[Server] Crop expression request: ${imagePath}`);

        const result = await cropExpression(imagePath);

        console.log(`[Server] Expression cropped via ${result.method}: box=${JSON.stringify(result.box)}`);

        return {
            success: true,
            croppedBase64: result.croppedBase64,
            box: result.box,
            method: result.method,
        };
    } catch (error: any) {
        console.error('[Server] Crop expression failed:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
