import { defineEventHandler, createError } from 'h3';

export default defineEventHandler((event) => {
    if (!event.context.user) {
        throw createError({
            statusCode: 401,
            statusMessage: '認証情報が見つかりません。'
        });
    }

    return {
        success: true,
        user: event.context.user
    };
});
