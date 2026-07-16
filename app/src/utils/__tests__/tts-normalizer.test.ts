import { describe, test, expect, vi } from 'vitest';
import { normalizeTextForTts, createTtsNormalizer, stripResidualAsterisks } from '../tts-normalizer';
import { filterDialogue } from '../dialogue-filter';
import ttsPostHandler from '../../server/api/tts.post';
import { VoiceAiService } from '../../server/utils/voice-ai-service';
import * as serverNormalizer from '../../server/utils/tts-normalizer';
import * as h3 from 'h3';

// h3 のモック
vi.mock('h3', async () => {
    const actual = await vi.importActual<typeof import('h3')>('h3');
    return {
        ...actual,
        readBody: vi.fn()
    };
});

// VoiceAiService のモック
vi.mock('../../server/utils/voice-ai-service', () => {
    return {
        VoiceAiService: {
            synthesize: vi.fn().mockResolvedValue('mock-audio-base64'),
            synthesizeIrodori: vi.fn().mockResolvedValue('mock-audio-base64')
        }
    };
});

describe('normalizeTextForTts のユニットテスト', () => {

    test('1. マークダウンマーカー除去 - 強調やコード、打ち消し記号が除去され、単一アスタリスクやアンダースコアは保持されること', () => {
        expect(normalizeTextForTts('**bold**')).toBe('bold');
        expect(normalizeTextForTts('__bold__')).toBe('bold');
        expect(normalizeTextForTts('`code`')).toBe('code');
        expect(normalizeTextForTts('~~strike~~')).toBe('strike');
        expect(normalizeTextForTts('*italic*')).toBe('*italic*');
        expect(normalizeTextForTts('_italic_')).toBe('_italic_');
    });

    test('2. リンク - マークダウン形式 of リンクが表示テキストのみに変換されること', () => {
        expect(normalizeTextForTts('[表示](https://example.com)')).toBe('表示');
        expect(normalizeTextForTts('![構成図](https://example.com/image.png)')).toBe('構成図');
    });

    test('2-2. Markdown構造 - 見出し・表・箇条書き・水平線が自然な読み上げ文に変換されること', () => {
        const text = [
            '### 🌟 ざっくり言うと…？',
            '',
            '| ツール | 役割 | 特徴 |',
            '|--------|------|------|',
            '| **ESLint** | ルールチェック | リンター |',
            '',
            '---',
            '- **設定管理が簡単**',
            '1. 導入する'
        ].join('\n');

        expect(normalizeTextForTts(text)).toBe([
            '🌟 ざっくり言うと…？',
            'ツール、役割、特徴',
            'イーエスリント、ルールチェック、リンター',
            '設定管理が簡単',
            '導入する'
        ].join('\n'));
    });

    test('2-3. IT用語 - ログに含まれるツール名が日本語の読みに変換されること', () => {
        expect(normalizeTextForTts('Biome、ESLint、Prettier、Type Inference、tsc、Oxc、Rust、CI/CD')).toBe(
            'バイオーム、イーエスリント、プリティア、タイプインファレンス、ティーエスシー、オーエックスシー、ラスト、シーアイシーディー'
        );
    });

    test('3. 時刻変換 - 適切な時刻コロン表記が日本語読みに変換され、全角数字は変換されないこと', () => {
        expect(normalizeTextForTts('11:00')).toBe('11時');
        expect(normalizeTextForTts('11:15')).toBe('11時15分');
        expect(normalizeTextForTts('11：00')).toBe('11時');
        expect(normalizeTextForTts('１１：００')).toBe('１１：００');
    });

    test('4. 時刻の境界 - 時刻ではない形式やIPアドレスのポート番号などが変換されないこと', () => {
        expect(normalizeTextForTts('1:75')).toBe('1:75');
        expect(normalizeTextForTts('11:22:33')).toBe('11:22:33');
        expect(normalizeTextForTts('192.168.1.1:80')).toBe('192.168.1.1:80');
        expect(normalizeTextForTts('10.0.0.1:50021')).toBe('10.0.0.1:50021');
        expect(normalizeTextForTts('11:30.')).toBe('11時30分.');
    });

    test('5. 日付変換 - 適切なスラッシュ日付やハイフン日付が日本語表記に変換され、先頭ゼロは除去され、全角数字は変換されないこと', () => {
        expect(normalizeTextForTts('2026/07/13')).toBe('2026年7月13日');
        expect(normalizeTextForTts('7/13')).toBe('7月13日');
        expect(normalizeTextForTts('2026-07-13')).toBe('2026年7月13日');
        expect(normalizeTextForTts('7／13')).toBe('7月13日');
        expect(normalizeTextForTts('07/03')).toBe('7月3日');
        expect(normalizeTextForTts('７／１３')).toBe('７／１３');
    });

    test('6. 日付の境界 - 不正な日付範囲やCIDR、分数、ハイフン月日のみなどが変換されないこと', () => {
        expect(normalizeTextForTts('13/32')).toBe('13/32');
        expect(normalizeTextForTts('1/2/3')).toBe('1/2/3');
        expect(normalizeTextForTts('1／2／3')).toBe('1／2／3');
        expect(normalizeTextForTts('10.0.0.0/24')).toBe('10.0.0.0/24');
        expect(normalizeTextForTts('7-13')).toBe('7-13');
    });

    test('7. 複合 - 日付と時刻が混在するテキストが正しく両方変換されること', () => {
        expect(normalizeTextForTts('7/13 11:00')).toBe('7月13日 11時');
    });

    test('8. カタカナ置換 - 辞書置換が大文字小文字を無視し、最長一致かつ単語境界を考慮して動作すること', () => {
        expect(normalizeTextForTts('typescript')).toBe('タイプスクリプト');
        expect(normalizeTextForTts('WakeUp Mtg')).toBe('ウェイクアップ ミーティング');
        expect(normalizeTextForTts('APIs')).toBe('APIs');
    });

    test('8-2. 文末記号を伴う辞書語 - トークン末尾の記号を取り除いて辞書マッチすること、またピリオド含みキーは完全一致が優先されること', () => {
        const { normalizeTextForTts: testNormalize } = createTtsNormalizer({
            'api': 'エーピーアイ',
            'node.js': 'ノードジェイエス'
        });
        expect(testNormalize('APIを使う。')).toBe('エーピーアイを使う。');
        expect(testNormalize('API.')).toBe('エーピーアイ.');
        expect(testNormalize('API,')).toBe('エーピーアイ,');
        expect(testNormalize('Node.js')).toBe('ノードジェイエス');
        expect(testNormalize('Node.js.')).toBe('ノードジェイエス.');
    });

    test('8-3. 複数語キーの境界 - 複数語の一部が別の単語の一部である場合は置換されないこと', () => {
        expect(normalizeTextForTts('AwakeUp Mtgs')).toBe('AwakeUp Mtgs');
    });

    test('8-4. 単一パス保証 - 複数語キーの置換値に英字が含まれる場合でも、単語置換が再走査して連鎖置換を起こさないこと', () => {
        const { normalizeTextForTts: testNormalize } = createTtsNormalizer({
            'test-wakeup mtg': 'ウェイク アップ',
            'アップ': '上'
        });
        expect(testNormalize('test-wakeup mtg')).toBe('ウェイク アップ');
    });

    test('9. 辞書優先順位 - マスコット個別 > アプリ共通 > IT補助 > デフォルト層の順に優先されること', () => {
        const { normalizeTextForTts: testNormalize } = createTtsNormalizer({
            'api': 'デフォルトエーピーアイ',
            'custom-key': 'デフォルトカスタム'
        });

        expect(testNormalize('API')).toBe('エーピーアイ');
        expect(testNormalize('API', { 'api': 'マイエーピーアイ' })).toBe('マイエーピーアイ');
        expect(testNormalize('custom-key')).toBe('デフォルトカスタム');
    });

    test('10. 辞書の安全性 - 特殊文字キーの置換、各種上限（エントリ数、長さ）での無視、値の文字種制限が機能すること', () => {
        const { normalizeTextForTts: testNormalize } = createTtsNormalizer({
            'c++': 'シープラスプラス'
        });
        expect(testNormalize('C++')).toBe('シープラスプラス');

        const { normalizeTextForTts: testInvalidValueNormalize } = createTtsNormalizer({
            'gpt': 'GPTモデル',
            'date': '7/13',
            'time': '11:00',
            'bold': '*ボールド*',
            'normal': 'ノーマル'
        });
        expect(testInvalidValueNormalize('gpt')).toBe('gpt');
        expect(testInvalidValueNormalize('date')).toBe('date');
        expect(testInvalidValueNormalize('time')).toBe('time');
        expect(testInvalidValueNormalize('bold')).toBe('bold');
        expect(testInvalidValueNormalize('normal')).toBe('ノーマル');

        const longKey = 'a'.repeat(65);
        const longVal = 'ア'.repeat(257);
        const { normalizeTextForTts: testLimitNormalize } = createTtsNormalizer({
            [longKey]: 'テスト',
            'valid-key': longVal,
            'ok-key': 'オッケー'
        });
        expect(testLimitNormalize(longKey)).toBe(longKey);
        expect(testLimitNormalize('valid-key')).toBe('valid-key');
        expect(testLimitNormalize('ok-key')).toBe('オッケー');
    });

    test('11. 感情タグ - 感情表現タグやタイマータグが誤変換されず保持されること', () => {
        expect(normalizeTextForTts('[happy]')).toBe('[happy]');
        expect(normalizeTextForTts('[TIMER:180,カップラーメン]')).toBe('[TIMER:180,カップラーメン]');
    });

    test('12. 冪等性 - 何回呼び出しても結果が変化せず、ゼロ幅スペースなどの不可視文字が含まれないこと', () => {
        const text = '7/13 11:00 に **WakeUp Mtg** があります。[happy]';
        const normalized1 = normalizeTextForTts(text);
        const normalized2 = normalizeTextForTts(normalized1);
        expect(normalized2).toBe(normalized1);
        expect(normalized1).not.toContain('\u200B');
    });

    test('13. stripResidualAsterisks - アスタリスク記号のみを除去し、normalize本体はアスタリスク自体を除去しないこと', () => {
        const text = '*描写* **強調**';
        expect(normalizeTextForTts(text)).toBe('*描写* 強調');
        expect(stripResidualAsterisks('*描写* **強調**')).toBe('描写 強調');
    });

    test('14. P1バグ対応: 上位辞書が保持される回帰テスト - defaultDict が1000件あってもIT補助やcustomDictが切り捨てられないこと', () => {
        // 1000件のダミー辞書を生成
        const largeDefaultDict: Record<string, string> = {};
        for (let i = 0; i < 1000; i++) {
            largeDefaultDict[`dummykey${i}`] = 'ダミー値';
        }
        
        // largeDefaultDict をデフォルト層としてノーマライザーを生成
        const { normalizeTextForTts: testNormalize } = createTtsNormalizer(largeDefaultDict);

        // IT補助 (API -> エーピーアイ) と customDict (mtg -> ミーティング) が正常に置換されるか検証
        expect(testNormalize('API')).toBe('エーピーアイ');
        expect(testNormalize('mtg', { 'mtg': 'ミーティング' })).toBe('ミーティング');
    });

    test('15. P1バグ対応: customDict の1000件上限 - customDict が1001件以上のとき超過分は無視され、信頼レイヤは影響を受けないこと', () => {
        // 1001件のカスタム辞書
        const largeCustomDict: Record<string, string> = {};
        for (let i = 0; i < 1001; i++) {
            largeCustomDict[`customkey${i}`] = 'カスタム';
        }
        // 1001番目のエントリ
        largeCustomDict['limitkey'] = '限界';

        const { normalizeTextForTts: testNormalize } = createTtsNormalizer();

        // 限界突破したエントリは置換されない
        expect(testNormalize('limitkey', largeCustomDict)).toBe('limitkey');

        // 通常のIT補助は正しく置換されること (信頼レイヤが影響を受けない)
        expect(testNormalize('API', largeCustomDict)).toBe('エーピーアイ');
    });

    test('16. P1バグ対応: 空文字値の無視 - 値が空文字のエントリは無視され置換（無音削除）されないこと', () => {
        const { normalizeTextForTts: testNormalize } = createTtsNormalizer();
        // 空文字の値を持つエントリを渡す
        const text = 'foo';
        expect(testNormalize(text, { 'foo': '' })).toBe('foo'); // 置換されず残る
    });
});

describe('TTS正規化 統合・経路テスト', () => {
    test('1. 経路1相当の結合テスト - filterDialogue と normalize, stripの適用順序の検証', () => {
        const text = '7/13 11:00 に **WakeUp Mtg** があります。 *手を振る*';

        const normalized = normalizeTextForTts(text);
        const dialogueFiltered = filterDialogue(normalized);
        const finalSpeech = stripResidualAsterisks(dialogueFiltered);

        expect(finalSpeech).toBe('7月13日 11時 に ウェイクアップ ミーティング があります。');

        const finalSpeechNarrative = stripResidualAsterisks(normalized);
        expect(finalSpeechNarrative).toBe('7月13日 11時 に ウェイクアップ ミーティング があります。 手を振る');
    });

    test('3. 経路4相当のテスト - tts.post API ハンドラがテキストを正規化して VoiceAiService を呼び出すこと', async () => {
        vi.mocked(h3.readBody).mockResolvedValue({
            action: 'synthesize',
            engine: 'voicevox',
            text: '会議は 7/13 11:00 に Mtg。',
            endpoint: 'http://localhost:50021',
            speakerId: 1,
            ttsDictionary: { 'mtg': 'ミーティング' }
        });

        const response = await ttsPostHandler({} as any);
        expect(response.success).toBe(true);
        expect(VoiceAiService.synthesize).toHaveBeenCalledWith(
            '会議は 7月13日 11時 に ミーティング。',
            1,
            'http://localhost:50021',
            true
        );
    });

    test('3-2. TTS再送経路 - メッセージを文単位で合成し、複数音声を返すこと', async () => {
        vi.mocked(VoiceAiService.synthesizeIrodori).mockClear();
        vi.mocked(h3.readBody).mockResolvedValue({
            action: 'synthesizeBatch',
            engine: 'irodori',
            text: '一文目。🌟\n二文目！',
            endpoint: 'http://localhost:8088',
            model: 'irodori-tts',
            voice: 'default',
            emotion: 'neutral',
            ttsReadNarrative: true
        });

        const response = await ttsPostHandler({} as any);

        expect(response).toEqual({
            success: true,
            audios: ['mock-audio-base64', 'mock-audio-base64']
        });
        expect(VoiceAiService.synthesizeIrodori).toHaveBeenNthCalledWith(
            1,
            '一文目。',
            'http://localhost:8088',
            'irodori-tts',
            'default',
            'neutral',
            true
        );
        expect(VoiceAiService.synthesizeIrodori).toHaveBeenNthCalledWith(
            2,
            '二文目！',
            'http://localhost:8088',
            'irodori-tts',
            'default',
            'neutral',
            true
        );
    });

    test('4. サーバー側シムのテスト - サーバー側のシムが同じAPIを提供していること', () => {
        expect(serverNormalizer.normalizeTextForTts).toBeDefined();
        expect(serverNormalizer.stripResidualAsterisks).toBeDefined();
    });
});
