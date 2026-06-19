import { describe, test, expect } from 'vitest';
import { splitSentences } from '../sentence-splitter';

describe('splitSentences', () => {
    test('splitSentences - 基本的な句読点（。、！、？）で正しく分割されること', () => {
        const text = 'こんにちは。元気ですか？私はとても元気です！今日も頑張りましょう。';
        const expected = [
            'こんにちは。',
            '元気ですか？',
            '私はとても元気です！',
            '今日も頑張りましょう。'
        ];
        expect(splitSentences(text)).toEqual(expected);
    });

    test('splitSentences - 閉じ括弧が直前の文章に正しく結合されて分割されること', () => {
        const text = 'うんっ！おまえが「もう一度！」って言うとミヤコは超嬉しいんだから！';
        const expected = [
            'うんっ！',
            'おまえが「もう一度！」',
            'って言うとミヤコは超嬉しいんだから！'
        ];
        expect(splitSentences(text)).toEqual(expected);
    });

    test('splitSentences - 連続する感嘆符や絵文字が分離せず文末に正しく残ること', () => {
        const text = 'ミヤコは超嬉しいんだから！！ 😆\n今日の話題はプリンだよ！ 🍮';
        const expected = [
            'ミヤコは超嬉しいんだから！！ 😆',
            '今日の話題はプリンだよ！ 🍮'
        ];
        expect(splitSentences(text)).toEqual(expected);
    });

    test('splitSentences - 括弧とMarkdownの装飾記号が正しく結合されること', () => {
        const text = 'ヒミツのプリンレシピ （再び！）**\n作り方を紹介するね。';
        const expected = [
            'ヒミツのプリンレシピ （再び！）**',
            '作り方を紹介するね。'
        ];
        expect(splitSentences(text)).toEqual(expected);
    });

    test('splitSentences - 二重の閉じ括弧や複合記号が分離しないこと', () => {
        const text = '（それはちょっとだけ甘いでも超楽しいよ！） 🍦🎉\n（ミヤコはいつも「ほんの少しだけ熱くしてね！」って言うの！）';
        const expected = [
            '（それはちょっとだけ甘いでも超楽しいよ！） 🍦🎉',
            '（ミヤコはいつも「ほんの少しだけ熱くしてね！」',
            'って言うの！）'
        ];
        expect(splitSentences(text)).toEqual(expected);
    });

    test('splitSentences - 箇条書きや連番の数字（1.など）が誤って前の文に巻き込まれないこと', () => {
        const text = '弱火で温める！\n1. カスタードを入れてよく混ぜる〜！';
        const expected = [
            '弱火で温める！',
            '1. カスタードを入れてよく混ぜる〜！'
        ];
        expect(splitSentences(text)).toEqual(expected);
    });

    test('splitSentences - 空文字やnullなどのエッジケースでエラーにならず空配列が返ること', () => {
        expect(splitSentences('')).toEqual([]);
        expect(splitSentences(null as any)).toEqual([]);
        expect(splitSentences(undefined as any)).toEqual([]);
    });
});
