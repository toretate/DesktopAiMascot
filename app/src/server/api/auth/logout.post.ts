import { defineEventHandler, deleteCookie, getRequestURL } from 'h3';

export default defineEventHandler((event) => {
    const isSecureRequest = getRequestURL(event).protocol === 'https:';
    
    deleteCookie(event, 'session_token', {
        path: '/',
        secure: isSecureRequest,
        sameSite: 'lax'
    });

    return {
        success: true,
        message: 'ログアウトしました。'
    };
});
