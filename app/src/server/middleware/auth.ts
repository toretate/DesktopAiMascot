import { defineEventHandler, getHeader, getCookie, createError } from 'h3';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { verifyGoogleIdToken } from '../utils/auth-service';
import { USERS_FILE_PATH } from '../utils/paths';
import { isAuthBypassAllowed } from '../utils/auth-bypass';

export interface Identity {
    provider: string;
    providerUserId: string;
    email: string;
}

export interface User {
    id: string; // 内部ユーザーID
    role: string;
    createdAt?: string;
    identities: Identity[];
}

interface UsersConfig {
    users: User[];
}

// users.jsonを読み込む関数
export function readUsersConfig(): UsersConfig {
    try {
        if (!fs.existsSync(USERS_FILE_PATH)) {
            return { users: [] };
        }
        const data = fs.readFileSync(USERS_FILE_PATH, 'utf8');
        const parsed = JSON.parse(data);

        // 旧形式 allowedUsers が存在する場合のマイグレーション処理
        if (parsed.allowedUsers && !parsed.users) {
            const migratedUsers: User[] = parsed.allowedUsers.map((oldUser: any) => {
                const internalId = oldUser.sub === 'local-dev-bypass'
                    ? 'usr_local_dev_bypass'
                    : `usr_${crypto.randomBytes(8).toString('hex')}`;

                const identities: Identity[] = [];
                if (oldUser.email) {
                    identities.push({
                        provider: 'google',
                        providerUserId: oldUser.sub || '',
                        email: oldUser.email
                    });
                }

                return {
                    id: internalId,
                    role: oldUser.role || 'user',
                    createdAt: new Date().toISOString(),
                    identities
                };
            });
            const newConfig = { users: migratedUsers };
            writeUsersConfig(newConfig);
            console.log('[Auth] users.json を新形式（内部ユーザーID仲介モデル）にマイグレーションしました。');
            return newConfig;
        }

        return parsed as UsersConfig;
    } catch (error) {
        console.error('users.jsonの読み込みに失敗しました:', error);
        return { users: [] };
    }
}

// users.jsonを書き込む関数
export function writeUsersConfig(config: UsersConfig): void {
    try {
        fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
        console.error('users.jsonの書き込みに失敗しました:', error);
    }
}

/**
 * トークンの検証を行い、対応するユーザー情報を取得・または初回紐付けする共通関数
 */
export async function authenticateUserToken(token: string): Promise<User> {
    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
        throw new Error('GOOGLE_CLIENT_ID が環境変数に設定されていません。');
    }

    // 1. Google IDトークンの検証
    const payload = await verifyGoogleIdToken(token, clientId);

    // 2. email_verified が true であることを確認（セキュリティ要件）
    if (!payload.email_verified) {
        throw new Error('メールアドレスが確認されていないGoogleアカウントです。');
    }

    const email = payload.email.toLowerCase();
    const sub = payload.sub;

    // 3. ユーザー設定の読み込みと認証・アクティベーション処理
    const config = readUsersConfig();
    
    // providerUserId が Google sub と一致するユーザーを検索
    let matchedUser = config.users.find(u =>
        u.identities.some(ident => ident.provider === 'google' && ident.providerUserId === sub)
    );

    if (matchedUser) {
        return matchedUser;
    }

    // subが一致しない場合、emailが一致し且つsubが未紐付け(空)のユーザーを探す
    const emailMatchedUser = config.users.find(u =>
        u.identities.some(ident => 
            ident.provider === 'google' &&
            ident.email.toLowerCase() === email &&
            (!ident.providerUserId || ident.providerUserId.trim() === '')
        )
    );

    if (emailMatchedUser) {
        // 初回ログイン時のアクティベーション（subの自動紐付け）
        const googleIdent = emailMatchedUser.identities.find(ident => 
            ident.provider === 'google' && ident.email.toLowerCase() === email
        );
        if (googleIdent) {
            googleIdent.providerUserId = sub;
            writeUsersConfig(config);
            console.log(`ユーザーの初回紐付けが完了しました: ${email} -> sub: ${sub}`);
            return emailMatchedUser;
        }
    }

    throw new Error('このアカウントでのアクセスは許可されていません。');
}

export default defineEventHandler(async (event) => {
    // リクエストURIを取得して、APIリクエストでなければスキップ（例: /_nuxt/ など静的ファイルやWEBフロントエンドページへのアクセス）
    const url = (event.path || '').split('?')[0];
    if (!url.startsWith('/api/')) {
        return;
    }

    // 認証開始・OAuthコールバック・pingは未認証でアクセスできる必要がある。
    if (url === '/api/ping' || url === '/api/auth/login' || url === '/api/auth/callback') {
        return;
    }

    // 開発・家庭内テスト用の認証バイパスは、明示的な環境変数がある場合だけ許可する。
    if (isAuthBypassAllowed()) {
        event.context.user = {
            id: 'usr_local_dev_bypass',
            email: 'test-user@gmail.com',
            role: 'user'
        };
        return;
    }

    let token = '';

    // 1. Authorization ヘッダーをチェック
    const authHeader = getHeader(event, 'authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    // 2. Cookie をチェック (session_token)
    if (!token) {
        token = getCookie(event, 'session_token') || '';
    }

    if (!token) {
        throw createError({
            statusCode: 401,
            message: '未認証です。ログインしてからもう一度お試しください。'
        });
    }

    try {
        const user = await authenticateUserToken(token);
        
        // ユーザーIDに紐づく主要なメールアドレス（Googleなど）を取得
        const primaryEmail = user.identities.find(ident => ident.email)?.email || '';

        event.context.user = {
            id: user.id,
            email: primaryEmail,
            role: user.role
        };
    } catch (error: any) {
        console.error('認証ミドルウェアエラー:', error.message);
        if (error.message.includes('GOOGLE_CLIENT_ID')) {
            throw createError({
                statusCode: 500,
                message: 'サーバーの認証設定が未完了です。'
            });
        }
        if (error.message.includes('許可されていません') || error.message.includes('確認されていない')) {
            throw createError({
                statusCode: 403,
                message: error.message
            });
        }
        throw createError({
            statusCode: 401,
            message: `認証に失敗しました: ${error.message}`
        });
    }
});
