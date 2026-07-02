import { defineEventHandler, readBody, createError } from 'h3';
import { extractExpressionParts } from '../../utils/expression-edit-service';

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        const { nofacePath, expressionPath, outputPath, offsetX, offsetY, scale, rotation } = body as {
            nofacePath?: string;
            expressionPath?: string;
            outputPath?: string;
            offsetX?: number;
            offsetY?: number;
            scale?: number;
            rotation?: number;
        };

        if (!nofacePath || !expressionPath || !outputPath) {
            throw createError({
                statusCode: 400,
                statusMessage: 'nofacePath, expressionPath, and outputPath are required'
            });
        }

        console.log(`[Server] Extracting expression parts for ${expressionPath} with offset=[${offsetX}, ${offsetY}] scale=${scale} rotation=${rotation}`);
        const result = await extractExpressionParts(
            nofacePath,
            expressionPath,
            outputPath,
            offsetX || 0,
            offsetY || 0,
            scale || 1.0,
            rotation || 0
        );

        if (!result.success) {
            throw new Error(result.error || 'Unknown error during extraction');
        }

        return {
            success: true,
            outputPath: outputPath,
            width: result.width,
            height: result.height
        };
    } catch (error: any) {
        console.error('[Server] extract-parts failed:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
