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

    test('filterDialogue - 単語の強調（括弧の直後が「と」や「って」ではない場合）は、全体を読み上げ対象として括弧だけを除去すること', () => {
        const text = 'それは「時間になったもの」を全て自動で消去してほしいということですね？「食事」は既に過ぎています。';
        expect(filterDialogue(text)).toBe('それは時間になったものを全て自動で消去してほしいということですね？食事は既に過ぎています。');
    });

    test('filterDialogue - 括弧の直後に句読点や改行、または文末が来る場合も、全体を読み上げ対象とすること', () => {
        // 直後に読点
        expect(filterDialogue('もし「〇時になったら教えて！」、リマインド設定もできますよ！👌')).toBe('もし〇時になったら教えて！、リマインド設定もできますよ！👌');
        // 直後に改行
        expect(filterDialogue('もし「〇時になったら教えて！」\nリマインド設定もできますよ！👌')).toBe('もし〇時になったら教えて！\nリマインド設定もできますよ！👌');
        // 直後が文末
        expect(filterDialogue('かしこまりました！「〇時になったら教えて！」')).toBe('かしこまりました！〇時になったら教えて！');
    });

    test('filterDialogue - 波ダッシュや感嘆符を含む文章が誤ってト書き（地の文）扱いされて切り落とされないこと', () => {
        const text = 'はーい、了解です〜！「〇〇を登録したよ！」';
        expect(filterDialogue(text)).toBe('はーい、了解です〜！〇〇を登録したよ！');
    });

    test('filterDialogue - 今日の予定を消去するテキストに対する挙動テスト', () => {
        const text = 'えっ？今日の予定を全部消しちゃうの？😳💦 大副かな？🥺 でも、マスターがそう言うなら仕方ないよ！👌 じゃあ、今の「今日の予定」を全てリセット（削除）するね！💨 ...はいっ！ 今日のスケジュールはキレイさっぱり空っぽになったよ！😌 これでスッキリしたね！💕 他に何か消したいものとかある？それとも新しいことを始めようか？🤔 💋';
        const result = filterDialogue(text);
        expect(result).not.toBe('今日の予定');
        expect(result).toContain('えっ？今日の予定を全部消しちゃうの？');
    });
});
