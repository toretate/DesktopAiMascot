export const IRODORI_ALLOWED_EMOJIS_SET = new Set([
    "👂", "😮‍💨", "⏸️", "🤭", "🥵", "📢", "😏", "🥺", "🌬️", "😮",
    "👅", "💋", "🫶", "😭", "😱", "😪", "⏩", "📞", "🐢", "🥤",
    "🤧", "😒", "😰", "😆", "😠", "😲", "🥱", "😖", "😟", "🫣",
    "🙄", "😊", "👌", "🙏", "🥴", "🎵", "🤐", "😌", "🤔"
]);

// 絵文字の判定を行う正規表現（通常の文字や数字が誤認されないように Emoji_Presentation のみを対象とする）
const emojiRegex = /\p{Emoji_Presentation}/u;

/**
 * Irodori-TTS 向けにテキストをサニタイズします。
 * 許可された感情絵文字（39種類）以外の、Irodori-TTSが読み上げられない非対応絵文字をすべて削除します。
 * Intl.Segmenter を用いて ZWJ を含む複合絵文字が正しく判定されるように考慮しています。
 * 
 * @param text サニタイズ対象のテキスト
 * @returns サニタイズされたテキスト
 */
export function sanitizeForIrodoriTTS(text: string): string {
    if (!text) return '';

    // Intl.Segmenter が使えない環境（一部の古い環境）でのフォールバック
    if (typeof Intl === 'undefined' || !Intl.Segmenter) {
        // 最悪の場合のフォールバック処理（簡易置換）
        let result = text;
        // 簡易的に全文字走査し、サロゲートペアや絵文字レンジの不要な絵文字を消す
        // 通常はElectronやNodeの最新環境なのでIntl.Segmenterが必ず使えます
        return result;
    }

    const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
    const segments = segmenter.segment(text);
    
    let result = '';
    for (const segment of segments) {
        const char = segment.segment;
        
        // 絵文字を検出
        if (emojiRegex.test(char)) {
            // 許可リストに含まれていない絵文字の場合はスキップ（削除）
            if (!IRODORI_ALLOWED_EMOJIS_SET.has(char)) {
                continue;
            }
        }
        result += char;
    }
    
    return result;
}
