/**
 * 与えられたテキストを、音声合成に適した文節（文）単位に分割します。
 */
export function splitSentences(text: string): string[] {
    if (!text) return [];

    const rawSentences = text.split(/(?<=[。！？\n])/gu);
    const sentences: string[] = [];

    const trailingRegex = /^[\s」』）\]\}"'！？!?。.\*~ー\p{Emoji_Presentation}\u200d\uFE0F\u200b〜・…♪☆★※+-]+/gu;

    for (const part of rawSentences) {
        if (!part) continue;
        if (sentences.length === 0) {
            sentences.push(part);
        } else {
            const match = part.match(trailingRegex);
            if (match) {
                const trailingContent = match[0];
                const remainingContent = part.substring(trailingContent.length);
                sentences[sentences.length - 1] += trailingContent;
                if (remainingContent.trim()) {
                    sentences.push(remainingContent);
                }
            } else {
                sentences.push(part);
            }
        }
    }

    return sentences
        .map(s => s.trim())
        .filter(s => s.length > 0);
}
