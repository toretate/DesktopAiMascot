import * as https from 'https';
import * as crypto from 'crypto';

interface JWK {
    kty: string;
    alg: string;
    use: string;
    kid: string;
    n: string;
    e: string;
}

interface JWKS {
    keys: JWK[];
}

export interface GoogleTokenPayload {
    iss: string;
    sub: string;
    aud: string;
    exp: number;
    email: string;
    email_verified: boolean;
    name?: string;
    picture?: string;
}

// GoogleのJWKSキャッシュ用
let cachedKeys: Map<string, crypto.KeyObject> = new Map();
let lastFetchTime = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24時間

// Base64URLデコード関数
function base64urlDecode(str: string): string {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    return Buffer.from(base64 + padding, 'base64').toString('utf8');
}

// Base64URLからBufferへの変換
function base64urlToBuffer(str: string): Buffer {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    return Buffer.from(base64 + padding, 'base64');
}

// Googleの公開鍵を取得する関数
async function fetchGoogleKeys(): Promise<void> {
    return new Promise((resolve, reject) => {
        https.get('https://www.googleapis.com/oauth2/v3/certs', (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const jwks = JSON.parse(data) as JWKS;
                    const newKeys = new Map<string, crypto.KeyObject>();
                    for (const key of jwks.keys) {
                        // JWKから公開鍵オブジェクトを生成
                        const publicKey = crypto.createPublicKey({
                            key: key as any, // Node.jsの型定義に合わせてキャスト
                            format: 'jwk'
                        });
                        newKeys.set(key.kid, publicKey);
                    }
                    cachedKeys = newKeys;
                    lastFetchTime = Date.now();
                    resolve();
                } catch (error) {
                    reject(new Error(`Google公開鍵のパースに失敗しました: ${error}`));
                }
            });
        }).on('error', (err) => {
            reject(new Error(`Google公開鍵の取得に失敗しました: ${err.message}`));
        });
    });
}

// 指定したkidに対応する公開鍵を取得（キャッシュ対応）
async function getGooglePublicKey(kid: string): Promise<crypto.KeyObject> {
    const now = Date.now();
    // キャッシュがない、または期限切れ、または指定のkidが見つからない場合は再取得
    if (cachedKeys.size === 0 || now - lastFetchTime > CACHE_TTL || !cachedKeys.has(kid)) {
        await fetchGoogleKeys();
    }
    
    const key = cachedKeys.get(kid);
    if (!key) {
        throw new Error(`指定された kid (${kid}) に対応する公開鍵が見つかりません。`);
    }
    return key;
}

/**
 * Google IDトークンの検証を行う
 * @param token Google IDトークン (JWT)
 * @param expectedClientId 本システムのGoogleクライアントID
 */
export async function verifyGoogleIdToken(token: string, expectedClientId: string): Promise<GoogleTokenPayload> {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('無効なトークンフォーマットです。');
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // 1. ヘッダーのデコードとkidの取得
    const headerJson = JSON.parse(base64urlDecode(headerB64));
    if (headerJson.alg !== 'RS256') {
        throw new Error(`サポートされていない署名アルゴリズムです: ${headerJson.alg}`);
    }
    const kid = headerJson.kid;
    if (!kid) {
        throw new Error('トークンヘッダーに kid が含まれていません。');
    }

    // 2. ペイロードのデコード
    const payload = JSON.parse(base64urlDecode(payloadB64)) as GoogleTokenPayload;

    // 3. クレームの基本検証
    // 有効期限の確認
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp < nowInSeconds) {
        throw new Error('トークンの有効期限が切れています。');
    }

    // 発行元の確認
    if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
        throw new Error(`無効な発行元です: ${payload.iss}`);
    }

    // オーディエンス（クライアントID）の確認
    if (payload.aud !== expectedClientId) {
        throw new Error(`無効なオーディエンスです。期待値: ${expectedClientId}, 実際値: ${payload.aud}`);
    }

    // 4. 署名の検証
    const publicKey = await getGooglePublicKey(kid);
    const verify = crypto.createVerify('SHA256');
    verify.update(`${headerB64}.${payloadB64}`);
    
    const signatureBuffer = base64urlToBuffer(signatureB64);
    const isSignatureValid = verify.verify(publicKey, signatureBuffer);

    if (!isSignatureValid) {
        throw new Error('トークンの署名検証に失敗しました。');
    }

    return payload;
}
