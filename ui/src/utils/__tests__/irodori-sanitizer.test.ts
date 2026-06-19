import { describe, test, expect } from 'vitest';
import { sanitizeForIrodoriTTS } from '../irodori-sanitizer';

describe('sanitizeForIrodoriTTS', () => {
    test('sanitizeForIrodoriTTS - 許可された絵文字が正しく残ること', () => {
        const text = 'ミヤコはお話が大好きなの〜！ 🥺 😆 😊';
        const expected = 'ミヤコはお話が大好きなの〜！ 🥺 😆 😊';
        expect(sanitizeForIrodoriTTS(text)).toBe(expected);
    });

    test('sanitizeForIrodoriTTS - 非対応の絵文字のみが削除されること', () => {
        const text = 'プリンは最高！ 🍮 🍦 🎉 うまい！ 😆';
        // 🍮, 🍦, 🎉 は非対応なので削除され、😆 は対応しているので残る
        const expected = 'プリンは最高！    うまい！ 😆';
        expect(sanitizeForIrodoriTTS(text)).toBe(expected);
    });

    test('sanitizeForIrodoriTTS - ZWJを含む複合絵文字が正しく判定・保持されること', () => {
        // 😮‍💨 は 😮 + ZWJ + 💨 で構成される複合絵文字
        const text = 'はあ、つかれた 😮‍💨';
        const expected = 'はあ、つかれた 😮‍💨';
        expect(sanitizeForIrodoriTTS(text)).toBe(expected);
    });

    test('sanitizeForIrodoriTTS - 普通のテキストや記号、スペースは削除されないこと', () => {
        const text = '作り方を紹介するね！ **材料：** (1カップ)';
        const expected = '作り方を紹介するね！ **材料：** (1カップ)';
        expect(sanitizeForIrodoriTTS(text)).toBe(expected);
    });

    test('sanitizeForIrodoriTTS - 空文字や不正なパラメータでエラーにならないこと', () => {
        expect(sanitizeForIrodoriTTS('')).toBe('');
        expect(sanitizeForIrodoriTTS(null as any)).toBe('');
        expect(sanitizeForIrodoriTTS(undefined as any)).toBe('');
    });
});
