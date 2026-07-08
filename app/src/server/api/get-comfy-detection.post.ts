import { defineEventHandler, readBody, createError } from 'h3';
import { resolveMascotPath } from '../utils/paths';
import fs from 'fs';

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

        // 画像の絶対パスを取得し、拡張子を .json に変更する
        const absoluteImagePath = resolveMascotPath(imagePath);
        const jsonPath = absoluteImagePath.replace(/\.[^/.]+$/, '.json');

        if (!fs.existsSync(jsonPath)) {
            return { success: false, exists: false };
        }

        const rawData = fs.readFileSync(jsonPath, 'utf-8');
        const detectionData = JSON.parse(rawData);

        return { success: true, exists: true, data: detectionData };
    } catch (error: any) {
        console.error('[Server] Failed to get comfy detection JSON:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
