import { defineEventHandler, createError, sendStream, setResponseHeader } from 'h3';
import fs from 'fs';
import path from 'path';
import { MASCOTS_DIR } from '../../utils/paths';

const MIME_TYPES: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.json': 'application/json',
};

export default defineEventHandler((event) => {
    const subpath = event.context.params?.path;
    if (!subpath) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Path is required',
        });
    }

    const decodedSubpath = decodeURIComponent(subpath);
    const targetPath = path.resolve(MASCOTS_DIR, decodedSubpath);

    // ディレクトリトラバーサル防止 (MASCOTS_DIRの配下にあるか確認)
    if (!targetPath.startsWith(MASCOTS_DIR)) {
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden access',
        });
    }

    // ファイルの存在確認
    if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
        throw createError({
            statusCode: 404,
            statusMessage: 'File not found',
        });
    }

    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    setResponseHeader(event, 'Content-Type', contentType);
    setResponseHeader(event, 'Cache-Control', 'public, max-age=3600');

    return sendStream(event, fs.createReadStream(targetPath));
});
