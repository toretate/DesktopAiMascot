import { describe, test, expect } from 'vitest';
import { filterDialogue } from '../dialogue-filter';

describe('filterDialogue', () => {
    test('filterDialogue - 「」や『』がある場合、その中のセリフ部分のみを抽出すること', () => {
        const text = '「おはよう！」と彼女は言った。『今日もいい天気だね。』';
        expect(filterDialogue(text)).toBe('おはよう！ 今日もいい天気だね。');
    });

    test('filterDialogue - 「」や『』がないが丸括弧やアスタリスクによる行動描写がある場合、それらを除去してセリフのみを抽出すること', () => {
        const text = '（眠そうに目をこすりながら）ふわぁ、よく寝た。*のびをする*';
        expect(filterDialogue(text)).toBe('ふわぁ、よく寝た。');
    });

    test('filterDialogue - 括弧が一切ない場合は全体をそのままセリフとして扱うこと', () => {
        const text = 'こんにちは！今日もよろしくお願いします。';
        expect(filterDialogue(text)).toBe('こんにちは！今日もよろしくお願いします。');
    });

    test('filterDialogue - 「」や『』の中が空の場合は無視されること', () => {
        const text = '「」何もないよ『』';
        expect(filterDialogue(text)).toBe('何もないよ');
    });

    test('filterDialogue - 行動描写の丸括弧の中に「」がある場合、それらを含めて正しく除去されること', () => {
        const text = '（ベッドという「プライベートな空間」を意識する）えっ？手を引いてベッドに？';
        expect(filterDialogue(text)).toBe('えっ？手を引いてベッドに？');
    });

    test('filterDialogue - 長文対話で一部が行動描写の括弧で囲まれ、残りがセリフの場合、セリフ部分のみをすべて抽出すること', () => {
        const text = '（一瞬動きが止まります。 😲）\nえっ？ 手を引いて ベッドに？ 💖\n（無意識にマスターの手首を掴み💪）\nねぇ、ボクのこの手、冷たい？';
        expect(filterDialogue(text)).toBe('えっ？ 手を引いて ベッドに？ 💖\nねぇ、ボクのこの手、冷たい？');
    });

    test('filterDialogue - 空文字やnullなどのエッジケースでエラーにならず空文字が返ること', () => {
        expect(filterDialogue('')).toBe('');
        expect(filterDialogue(null as any)).toBe('');
        expect(filterDialogue(undefined as any)).toBe('');
    });
});
