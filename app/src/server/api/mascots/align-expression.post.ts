import { defineEventHandler, readBody, createError } from 'h3';
import { alignExpression } from '../../utils/expression-edit-service';

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        const { basePath, expressionPath, detectMode } = body as { basePath?: string; expressionPath?: string; detectMode?: string };

        if (!basePath || !expressionPath) {
            throw createError({
                statusCode: 400,
                statusMessage: 'basePath and expressionPath are required'
            });
        }

        console.log(`[Server] Aligning expression ${expressionPath} with base ${basePath} using mode ${detectMode || 'ai'}`);
        const result = await alignExpression(basePath, expressionPath, detectMode);

        return result;
    } catch (error: any) {
        console.error('[Server] align-expression failed:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
