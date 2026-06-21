import { defineEventHandler, readBody, createError } from 'h3';
import fs from 'fs';
import path from 'path';
import { removeBackground } from '../utils/remove-bg-service';
import { resolveMascotPath } from '../utils/paths';

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        const { imagePath, mascotId, engine } = body;
        console.log(`[Server] Background removal request received for mascot: ${mascotId}, engine: ${engine}`);

        if (!imagePath) {
            throw createError({
                statusCode: 400,
                statusMessage: 'imagePath is required'
            });
        }

        let inputBuffer: Buffer;
        let mimeType = 'image/png';

        if (imagePath.startsWith('data:image/')) {
            const matches = imagePath.match(/^data:([a-zA-Z+/]+);base64,(.+)$/s);
            if (!matches || matches.length < 3) {
                throw createError({
                    statusCode: 400,
                    statusMessage: 'Invalid data URL format'
                });
            }
            mimeType = matches[1];
            const base64Data = matches[2];
            inputBuffer = Buffer.from(base64Data, 'base64');
            console.log(`[Server] DataURL converted to Buffer (mimeType: ${mimeType}, size: ${inputBuffer.length} bytes)`);
        } else if (imagePath.startsWith('/mascots/')) {
            const filePath = resolveMascotPath(imagePath);
            if (!fs.existsSync(filePath)) {
                throw createError({
                    statusCode: 404,
                    statusMessage: `File not found: ${filePath}`
                });
            }
            inputBuffer = fs.readFileSync(filePath);
            const ext = path.extname(filePath).replace('.', '').replace('jpg', 'jpeg');
            mimeType = `image/${ext}`;
            console.log(`[Server] File loaded as Buffer: ${filePath}`);
        } else {
            throw createError({
                statusCode: 400,
                statusMessage: 'Unsupported image source format'
            });
        }

        console.log(`[Server] Processing background removal using engine: ${engine}...`);

        const outputBuffer = await removeBackground(inputBuffer, mimeType, engine);
        const base64Image = `data:image/png;base64,${outputBuffer.toString('base64')}`;

        console.log(`[Server] Background removal complete. Sending result...`);
        return { success: true, image: base64Image };
    } catch (error: any) {
        console.error('[Server] Background removal failed:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
