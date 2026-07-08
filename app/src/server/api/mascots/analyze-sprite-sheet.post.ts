import { defineEventHandler, readBody, createError } from 'h3';
import { AiExpressionService } from '../../../skills/expression-service/expression-service';

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        const { imagePath, apiKey } = body as { imagePath?: string; apiKey?: string };

        if (!imagePath || !apiKey) {
            throw createError({
                statusCode: 400,
                statusMessage: 'imagePath and apiKey are required'
            });
        }

        const result = await AiExpressionService.analyzeSpriteSheet(imagePath, apiKey);
        return result;
    } catch (error: any) {
        console.error('[Server] analyze-sprite-sheet failed:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
