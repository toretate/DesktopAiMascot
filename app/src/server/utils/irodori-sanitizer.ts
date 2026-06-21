export const IRODORI_ALLOWED_EMOJIS_SET = new Set([
    "👂", "😮‍💨", "⏸️", "🤭", "🥵", "📢", "😏", "🥺", "🌬️", "😮",
    "👅", "💋", "🫶", "😭", "😱", "😪", "⏩", "📞", "🐢", "🥤",
    "🤧", "😒", "😰", "😆", "😠", "😲", "🥱", "😖", "😟", "🫣",
    "🙄", "😊", "👌", "🙏", "🥴", "🎵", "🤐", "😌", "🤔"
]);

const emojiRegex = /\p{Emoji_Presentation}/u;

/**
 * Irodori-TTS 向けにテキストをサニタイズします。
 */
export function sanitizeForIrodoriTTS(text: string): string {
    if (!text) return '';

    if (typeof Intl === 'undefined' || !Intl.Segmenter) {
        return text;
    }

    const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
    const segments = segmenter.segment(text);
    
    let result = '';
    for (const segment of segments) {
        const char = segment.segment;
        
        if (emojiRegex.test(char)) {
            if (!IRODORI_ALLOWED_EMOJIS_SET.has(char)) {
                continue;
            }
        }
        result += char;
    }
    
    return result;
}
