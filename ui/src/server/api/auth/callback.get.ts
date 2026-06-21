import { defineEventHandler, getQuery, setCookie, createError } from 'h3';
import * as https from 'https';
import { authenticateUserToken } from '../../middleware/auth';

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
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

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

        const isProduction = process.env.NODE_ENV === 'production';
        
        // Cookieの設定
        setCookie(event, 'session_token', idToken, {
            httpOnly: true,
            path: '/',
            maxAge: 3600,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax'
        });

        // ログイン成功画面の返却
        return `
            <!DOCTYPE html>
            <html lang="ja">
            <head>
                <meta charset="UTF-8">
                <title>ログイン完了</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        background: #f4f7f6;
                    }
                    .card {
                        background: white;
                        padding: 30px;
                        border-radius: 12px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                        text-align: center;
                        max-width: 400px;
                    }
                    h1 { color: #2ecc71; margin-bottom: 10px; }
                    p { color: #555; line-height: 1.5; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>ログイン完了</h1>
                    <p>認証に成功しました！このウィンドウを閉じて、マスコットアプリに戻ってください。</p>
                </div>
                <script>
                    setTimeout(() => {
                        window.close();
                    }, 3000);
                </script>
            </body>
            </html>
        `;
    } catch (error: any) {
        console.error('[Auth] コールバック処理エラー:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: `認証エラーが発生しました: ${error.message}`
        });
    }
});
