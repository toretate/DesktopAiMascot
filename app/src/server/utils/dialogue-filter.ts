export function filterDialogue(text: string): string {
    if (!text) return '';

    // 1. まず行動描写の括弧（全角丸括弧、半角丸括弧、アスタリスク）で囲まれた部分を除去する。
    // これにより、行動描写内にある「」なども一緒に消える。
    let cleanText = text;
    cleanText = cleanText.replace(/（[^）]*）/g, '');
    cleanText = cleanText.replace(/\([^)]*\)/g, '');
    cleanText = cleanText.replace(/\*[^*]+\*/g, '');

    // 2. 残ったテキストに対して、「」や『』があるか確認
    const hasJapaneseBrackets = /[「『]/.test(cleanText);
    
    if (hasJapaneseBrackets) {
        // 「」や『』の外側に、単語（文字）があるかどうかをチェックする。
        // すべての「...」と『...』を取り除いた残りのテキストに、実質的な文字が含まれているか？
        const strippedBrackets = cleanText.replace(/[「『].*?[」』]/g, '').trim();
        
        // 残った部分に、漢字・ひらがな・カタカナ・英数字などの言葉の文字が含まれているか
        // 記号やスペース、絵文字だけなら「外側には台詞以外の言葉がない」と判定する
        const hasTextOutside = /[\p{Letter}\p{Number}]/u.test(strippedBrackets);
        
        if (hasTextOutside) {
            // 括弧の外側に言葉がある場合（例: 「おはよう」と言った）
            // 括弧の中身だけを抽出して結合する
            const regex = /[「『](.*?)[」』]/g;
            let match;
            const parts: string[] = [];
            while ((match = regex.exec(cleanText)) !== null) {
                if (match[1].trim()) {
                    parts.push(match[1].trim());
                }
            }
            if (parts.length > 0) {
                return parts.join(' ');
            }
        }
        
        // 括弧の外側に言葉がない、または括弧の中身が空だった場合
        return cleanText.replace(/[「」『』]/g, '').trim();
    }
    
    // 3. 連続する改行や空行を整理する
    cleanText = cleanText.replace(/\n\s*\n+/g, '\n');
    return cleanText.trim();
}
