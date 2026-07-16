import { getRequestURL, type H3Event } from 'h3';

/**
 * Google OAuthのコールバックURIを解決する。
 * 明示設定を優先し、開発・LAN利用ではアクセス中のオリジンへ戻す。
 */
export function resolveGoogleRedirectUri(event: H3Event): string {
    const configuredUri = process.env.GOOGLE_REDIRECT_URI?.trim();
    if (configuredUri) {
        return configuredUri;
    }

    return new URL('/api/auth/callback', getRequestURL(event).origin).toString();
}
