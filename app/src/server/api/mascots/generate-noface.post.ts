import { defineEventHandler, readBody, createError } from 'h3';
import { generateNofaceImage } from '../../utils/expression-edit-service';

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        const { mascotId, inputPath, detectMode, engine, prompt, geminiApiKey } = body as {
            mascotId?: string;
            inputPath?: string;
            detectMode?: string;
            engine?: string;
            prompt?: string;
            geminiApiKey?: string;
        };

        if (!mascotId || !inputPath) {
            throw createError({
                statusCode: 400,
                statusMessage: 'mascotId and inputPath are required'
            });
        }

        // のっぺらぼう画像の保存先を決定
        const filename = `/mascots/users/usr_local_dev_bypass/${mascotId}/noface.png`;

        console.log(`[Server] Generating noface image for ${mascotId} from ${inputPath} with engine=${engine || 'mediapipe'} detectMode=${detectMode || 'ai'}`);
        const resultPath = await generateNofaceImage(inputPath, filename, detectMode, engine, prompt, geminiApiKey);

        return { success: true, path: resultPath };
    } catch (error: any) {
        console.error('[Server] generate-noface failed:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
