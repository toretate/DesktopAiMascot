import { defineEventHandler, createError, sendStream, setResponseHeader, getHeader, getCookie } from 'h3';
import fs from 'fs';
import path from 'path';
import { resolveMascotPath, USERS_DIR } from '../../utils/paths';
import { authenticateUserToken } from '../../middleware/auth';

const MIME_TYPES: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.json': 'application/json',
};

export default defineEventHandler(async (event) => {
    const subpath = event.context.params?.path;
    if (!subpath) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Path is required',
        });
    }

    const decodedSubpath = decodeURIComponent(subpath);
    const targetPath = resolveMascotPath(decodedSubpath);

    // ディレクトリトラバーサル防止
    // プリセットの場合は ui/src/public/mascots (あるいは .output/public)
    // ユーザー別の場合は storage/users
    // 解決された絶対パスがこれらの安全なディレクトリ配下にあるか検証します。
    const isDev = process.env.NODE_ENV !== 'production';
    const isUnderUsers = targetPath.startsWith(USERS_DIR);
    
    // ユーザー固有データのアクセス制限（認可処理）
    if (isUnderUsers) {
        // パス例: storage/users/{userId}/mascots/{mascotId}/...
        // ターゲットパスから userId を抽出
        const relativeToUsers = path.relative(USERS_DIR, targetPath);
        const pathParts = relativeToUsers.split(path.sep);
        const ownerUserId = pathParts[0]; // フォルダ構造の所有者ID

        // ログイン中のユーザー情報を取得
        let loginUserId = '';
        
        // 1. ローカルアクセスの確認 (開発環境でのバイパス)
        const req = event.node.req;
        const ip = req.socket.remoteAddress || '';
        const host = getHeader(event, 'host') || '';
        const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || host.includes('localhost') || host.includes('127.0.0.1');

        if (isLocal) {
            loginUserId = 'usr_local_dev_bypass';
        } else {
            // 2. トークン認証
            let token = '';
            const authHeader = getHeader(event, 'authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            }
            if (!token) {
                token = getCookie(event, 'session_token') || '';
            }

            if (!token) {
                throw createError({
                    statusCode: 401,
                    statusMessage: '認証トークンが必要です。',
                });
            }

            try {
                const user = await authenticateUserToken(token);
                loginUserId = user.id;
            } catch (authError: any) {
                throw createError({
                    statusCode: 401,
                    statusMessage: `認証に失敗しました: ${authError.message}`,
                });
            }
        }

        // 所有者とログインユーザーの一致を確認
        if (ownerUserId !== loginUserId) {
            throw createError({
                statusCode: 403,
                statusMessage: 'このリソースへのアクセス権限がありません。',
            });
        }
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
