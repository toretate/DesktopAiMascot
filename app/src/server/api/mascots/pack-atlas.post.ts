import { defineEventHandler, readBody, createError } from 'h3';
import { packTextureAtlas } from '../../utils/expression-edit-service';

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        const { mascotId, partsList } = body as {
            mascotId?: string;
            partsList?: Array<{ name: string; path: string; offsetX: number; offsetY: number }>;
        };

        if (!mascotId || !partsList || !Array.isArray(partsList)) {
            throw createError({
                statusCode: 400,
                statusMessage: 'mascotId and partsList (array) are required'
            });
        }

        console.log(`[Server] Packing texture atlas for ${mascotId} with ${partsList.length} parts`);
        const result = await packTextureAtlas(mascotId, partsList);

        if (!result.success) {
            throw new Error(result.error || 'Unknown error during packing');
        }

        return {
            success: true,
            atlasPath: result.atlasPath,
            jsonPath: result.jsonPath,
            width: result.width,
            height: result.height
        };
    } catch (error: any) {
        console.error('[Server] pack-atlas failed:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
