import { defineEventHandler, readBody, createError } from 'h3';
import { generateNofaceImage } from '../../utils/expression-edit-service';

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        const { mascotId, inputPath } = body as { mascotId?: string; inputPath?: string };

        if (!mascotId || !inputPath) {
            throw createError({
                statusCode: 400,
                statusMessage: 'mascotId and inputPath are required'
            });
        }

        // のっぺらぼう画像の保存先を決定
        const filename = `/mascots/users/usr_local_dev_bypass/${mascotId}/noface.png`;

        console.log(`[Server] Generating noface image for ${mascotId} from ${inputPath}`);
        const resultPath = await generateNofaceImage(inputPath, filename);

        return { success: true, path: resultPath };
    } catch (error: any) {
        console.error('[Server] generate-noface failed:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
