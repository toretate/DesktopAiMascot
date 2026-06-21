import { defineEventHandler, deleteCookie } from 'h3';

export default defineEventHandler((event) => {
    const isProduction = process.env.NODE_ENV === 'production';
    
    deleteCookie(event, 'session_token', {
        path: '/',
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax'
    });

    return {
        success: true,
        message: 'ログアウトしました。'
    };
});
