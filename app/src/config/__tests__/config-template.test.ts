import { describe, expect, it } from 'vitest';
import { createInitialConfig } from '../config-template';

describe('createInitialConfig', () => {
    it('createInitialConfig_APIキーとユーザー固有画像を含まないこと', () => {
        const config = createInitialConfig();

        expect(config.googleAiStudioApiKey).toBe('');
        expect(config.openaiApiKey).toBe('');
        expect(config.anthropicApiKey).toBe('');
        expect(config.chatBackgroundImage).toBe('');
        expect(config.mascotBackgroundImage).toBe('');
        expect(config.integratedBackgroundImage).toBe('');
        expect(JSON.stringify(config)).not.toContain('data:image/');
    });

    it('createInitialConfig_呼び出しごとに独立したマスコット設定を返すこと', () => {
        const first = createInitialConfig();
        const second = createInitialConfig();

        expect(first.mascots).not.toBe(second.mascots);
        expect(first.mascots[0]).not.toBe(second.mascots[0]);
    });
});
