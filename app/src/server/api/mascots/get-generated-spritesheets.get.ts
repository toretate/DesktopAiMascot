import { defineEventHandler, getQuery, createError } from 'h3';
import fs from 'node:fs';
import path from 'node:path';
import { resolveMascotPath } from '../../utils/paths';

export default defineEventHandler(async (event) => {
    try {
        const query = getQuery(event);
        const mascotId = query.mascotId as string;

        if (!mascotId) {
            throw createError({
                statusCode: 400,
                statusMessage: 'mascotId is required'
            });
        }

        let userId = 'usr_local_dev_bypass';
        if (event.context.user) {
            userId = event.context.user.id;
        }

        // expressions/working ディレクトリの物理パスを解決する
        const requestDir = `/mascots/users/${userId}/${mascotId}/expressions/working`;
        const absDir = resolveMascotPath(requestDir);

        const list: { url: string; timestamp: string; date: string }[] = [];

        if (fs.existsSync(absDir)) {
            const dirs = fs.readdirSync(absDir);
            for (const dirName of dirs) {
                const subDir = path.join(absDir, dirName);
                if (fs.statSync(subDir).isDirectory()) {
                    const files = fs.readdirSync(subDir);
                    const spriteFile = files.find(f => f.startsWith('spritesheet_') && f.endsWith('.png'));
                    if (spriteFile) {
                        const relativeUrl = `/mascots/users/${userId}/${mascotId}/expressions/working/${dirName}/${spriteFile}`;
                        const stat = fs.statSync(path.join(subDir, spriteFile));
                        const dateStr = stat.mtime.toLocaleString('ja-JP');
                        list.push({
                            url: relativeUrl,
                            timestamp: dirName,
                            date: dateStr
                        });
                    }
                }
            }
        }

        // タイムスタンプ順（降順＝新しい順）にソート
        list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        return { success: true, list };
    } catch (error: any) {
        console.error('[Server] get-generated-spritesheets failed:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
