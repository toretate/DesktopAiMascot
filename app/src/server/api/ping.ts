import { defineEventHandler } from 'h3';

export default defineEventHandler((event) => {
    console.log('[Server] Ping request received');
    return {
        success: true,
        message: 'pong',
        timestamp: new Date().toISOString()
    };
});
