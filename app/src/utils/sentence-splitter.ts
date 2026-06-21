/**
 * 与えられたテキストを、音声合成に適した文節（文）単位に分割します。
 * 閉じ括弧や絵文字、連続する感嘆符・記号が文末から単独で分離しないように、適切に結合処理を行います。
 * 
 * @param text 分割対象のテキスト
 * @returns 分割された文節の配列
 */
export function splitSentences(text: string): string[] {
    if (!text) return [];

    // まずは [。！？\n] を境界として単純に分割
    const rawSentences = text.split(/(?<=[。！？\n])/gu);
    const sentences: string[] = [];

    // 閉じ括弧、句読点、感嘆符、絵文字、スペース、Markdown記号などを文末に巻き込むための正規表現
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
