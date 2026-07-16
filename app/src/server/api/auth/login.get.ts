import { defineEventHandler, sendRedirect, createError } from 'h3';
import { resolveGoogleRedirectUri } from '../../utils/auth-redirect-uri';

export default defineEventHandler((event) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = resolveGoogleRedirectUri(event);

    if (!clientId) {
        throw createError({
            statusCode: 500,
            statusMessage: 'サーバーエラー: GOOGLE_CLIENT_ID が設定されていません。'
        });
    }

    const scope = 'openid email profile';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;

    console.log('[Auth] Googleログインへリダイレクトします');
    return sendRedirect(event, authUrl);
});
