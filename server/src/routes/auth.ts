import { Router } from 'express';
import * as https from 'https';
import { authenticateUserToken, authMiddleware } from '../middlewares/auth-middleware';

const router = Router();

// Googleのトークンエンドポイントに認可コードを送信してIDトークンを取得するヘルパー関数
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

// 1. ログイン開始エンドポイント
router.get('/auth/login', (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

    if (!clientId) {
        return res.status(500).send('サーバーエラー: GOOGLE_CLIENT_ID が設定されていません。');
    }

    const scope = 'openid email profile';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;

    console.log('[Auth] Googleログインへリダイレクトします');
    res.redirect(authUrl);
});

// 2. コールバックエンドポイント
router.get('/auth/callback', async (req, res) => {
    const code = req.query.code as string;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

    if (!code) {
        return res.status(400).send('認証コードがありません。');
    }
    if (!clientId || !clientSecret) {
        return res.status(500).send('サーバーの認証設定（クライアントIDまたはシークレット）が未設定です。');
    }

    try {
        // 2.1. 認可コードを Google IDトークンに交換
        const idToken = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);

        // 2.2. トークンの検証およびユーザーチェック（初回ログイン時はsub自動紐付け）
        const user = await authenticateUserToken(idToken);
        const primaryEmail = user.identities.find(ident => ident.email)?.email || '';
        console.log(`[Auth] ユーザーログイン成功: ${primaryEmail}`);

        // 2.3. Cookieの設定 (session_token としてIDトークンを格納)
        const isProduction = process.env.NODE_ENV === 'production';
        
        // クッキー設定オプション
        // SameSite: Lax（同一localhost間の別ポートで動作させるため、ローカル開発ではLaxが必須）
        // 本番でクロスオリジンの場合は None + Secure に動的切り替え
        let cookieOptions = `session_token=${idToken}; HttpOnly; Path=/; Max-Age=3600`;
        if (isProduction) {
            cookieOptions += '; Secure; SameSite=None';
        } else {
            cookieOptions += '; SameSite=Lax';
        }

        res.setHeader('Set-Cookie', cookieOptions);

        // 2.4. ブラウザにログイン成功の画面を表示
        res.send(`
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
                    // ログイン成功後、数秒後に自動で閉じることが可能な環境であれば閉じる
                    setTimeout(() => {
                        window.close();
                    }, 3000);
                </script>
            </body>
            </html>
        `);

    } catch (error: any) {
        console.error('[Auth] コールバック処理エラー:', error.message);
        res.status(500).send(`認証エラーが発生しました: ${error.message}`);
    }
});

// 3. ログインステータス確認エンドポイント
router.get('/auth/status', authMiddleware, (req, res) => {
    // authMiddleware を通過した時点で req.user が入っている
    res.json({
        success: true,
        user: req.user
    });
});

// 4. ログアウトエンドポイント
router.post('/auth/logout', (req, res) => {
    // Cookieを削除（有効期限を過去にする）
    const isProduction = process.env.NODE_ENV === 'production';
    let cookieOptions = 'session_token=; HttpOnly; Path=/; Max-Age=0';
    if (isProduction) {
        cookieOptions += '; Secure; SameSite=None';
    } else {
        cookieOptions += '; SameSite=Lax';
    }
    res.setHeader('Set-Cookie', cookieOptions);
    res.json({ success: true, message: 'ログアウトしました。' });
});

export default router;
