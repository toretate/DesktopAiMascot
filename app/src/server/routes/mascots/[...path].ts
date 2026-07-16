import { defineEventHandler, createError, sendStream, sendNoContent, setResponseHeader, getHeader, getCookie } from 'h3';
import fs from 'fs';
import path from 'path';
import { resolveMascotPath, USERS_DIR } from '../../utils/paths';
import { authenticateUserToken } from '../../middleware/auth';
import { isAuthBypassAllowed } from '../../utils/auth-bypass';

const MIME_TYPES: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.json': 'application/json',
};

export function createFileEtag(size: number, mtimeMs: number): string {
    return `W/"${size.toString(16)}-${Math.trunc(mtimeMs).toString(16)}"`;
}

const normalizeWeakEtag = (etag: string): string => etag.trim().replace(/^W\//, '');

export function isRequestNotModified(
    ifNoneMatch: string | undefined,
    ifModifiedSince: string | undefined,
    etag: string,
    mtimeMs: number
): boolean {
    // RFC 9110に従い、If-None-Matchが存在する場合はIf-Modified-Sinceより優先する。
    if (ifNoneMatch !== undefined) {
        if (ifNoneMatch.trim() === '*') return true;
        const current = normalizeWeakEtag(etag);
        return ifNoneMatch
            .split(',')
            .some(candidate => normalizeWeakEtag(candidate) === current);
    }

    if (!ifModifiedSince) return false;
    const sinceMs = Date.parse(ifModifiedSince);
    if (!Number.isFinite(sinceMs)) return false;
    return Math.floor(mtimeMs / 1000) <= Math.floor(sinceMs / 1000);
}

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
        
        // 開発・家庭内テスト用の認証バイパスは、明示的な環境変数がある場合だけ許可する。
        if (isAuthBypassAllowed()) {
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
                    message: '未認証です。ログインしてからもう一度お試しください。',
                });
            }

            try {
                const user = await authenticateUserToken(token);
                loginUserId = user.id;
            } catch (authError: any) {
                throw createError({
                    statusCode: 401,
                    message: `認証に失敗しました: ${authError.message}`,
                });
            }
        }

        // 所有者とログインユーザーの一致を確認
        if (ownerUserId !== loginUserId) {
            throw createError({
                statusCode: 403,
                message: 'このリソースへのアクセス権限がありません。',
            });
        }
    }

    // ファイルの存在確認
    if (!fs.existsSync(targetPath)) {
        throw createError({
            statusCode: 404,
            statusMessage: 'File not found',
        });
    }

    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
        throw createError({
            statusCode: 404,
            statusMessage: 'File not found',
        });
    }

    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const etag = createFileEtag(stat.size, stat.mtimeMs);
    const lastModified = stat.mtime.toUTCString();

    setResponseHeader(event, 'Content-Type', contentType);
    setResponseHeader(event, 'Cache-Control', 'no-cache');
    setResponseHeader(event, 'ETag', etag);
    setResponseHeader(event, 'Last-Modified', lastModified);

    if (isRequestNotModified(
        getHeader(event, 'if-none-match'),
        getHeader(event, 'if-modified-since'),
        etag,
        stat.mtimeMs
    )) {
        return sendNoContent(event, 304);
    }

    return sendStream(event, fs.createReadStream(targetPath));
});
