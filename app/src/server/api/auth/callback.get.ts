import { createError, defineEventHandler, getQuery, getRequestURL, sendRedirect, setCookie } from 'h3';
import * as https from 'https';
import { authenticateUserToken } from '../../middleware/auth';
import { resolveGoogleRedirectUri } from '../../utils/auth-redirect-uri';

function exchangeCodeForToken(code: string, clientId: string, clientSecret: string, redirectUri: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const postData = new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
        }).toString();

        const options = {
            hostname: 'oauth2.googleapis.com',
            port: 443,
            path: '/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error) {
                        reject(new Error(`Google Token Error: ${parsed.error_description || parsed.error}`));
                    } else if (parsed.id_token) {
                        resolve(parsed.id_token);
                    } else {
                        reject(new Error('レスポンスに id_token が含まれていません。'));
                    }
                } catch (e) {
                    reject(new Error('Googleトークンレスポンスのパースに失敗しました。'));
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.write(postData);
        req.end();
    });
}

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const code = query.code as string;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = resolveGoogleRedirectUri(event);

    if (!code) {
        throw createError({
            statusCode: 400,
            statusMessage: '認証コードがありません。'
        });
    }
    if (!clientId || !clientSecret) {
        throw createError({
            statusCode: 500,
            statusMessage: 'サーバーの認証設定（クライアントIDまたはシークレット）が未設定です。'
        });
    }

    try {
        // Google IDトークンを取得
        const idToken = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);

        // トークン検証とユーザー取得
        const user = await authenticateUserToken(idToken);
        const primaryEmail = user.identities.find(ident => ident.email)?.email || '';
        console.log(`[Auth] ユーザーログイン成功: ${primaryEmail}`);

        const isSecureRequest = getRequestURL(event).protocol === 'https:';
        
        // Cookieの設定
        setCookie(event, 'session_token', idToken, {
            httpOnly: true,
            path: '/',
            maxAge: 3600,
            secure: isSecureRequest,
            sameSite: 'lax'
        });

        // Webクライアントへ戻し、認証済み状態でアプリを再初期化する。
        return sendRedirect(event, '/');
    } catch (error: any) {
        console.error('[Auth] コールバック処理エラー:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: `認証エラーが発生しました: ${error.message}`
        });
    }
});
