import itOverrides from '../assets/tts-it-overrides.json';
import customOverrides from '../assets/tts-custom-overrides.json';

// 値として許可される文字種（ひらがな、カタカナ、漢字、長音符、中点、空白、句読点）
const ALLOWED_VALUE_REGEX = /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u3005\u3006\u3007ー・\s、。！？]*$/;

/**
 * 辞書値のバリデーションを行います。
 */
function isValidDictValue(value: any): boolean {
    if (typeof value !== 'string') return false;
    return ALLOWED_VALUE_REGEX.test(value);
}

/**
 * 正規表現用に文字列をエスケープします。
 */
function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 浅いオブジェクト比較を行います。
 */
function areObjectsEqual(objA: Record<string, string>, objB: Record<string, string>): boolean {
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
        if (objA[key] !== objB[key]) return false;
    }
    return true;
}

/**
 * TTS正規化関数を生成するファクトリ関数
 */
export function createTtsNormalizer(defaultDict: Record<string, string> = {}) {
    // キャッシュ情報
    let lastMergedDict: Record<string, string> = {};
    let cachedRegex: RegExp | null = null;
    let cachedMultiWordMap = new Map<string, string>();
    let cachedSingleWordMap = new Map<string, string>();

    /**
     * 1エントリ分の検証を行います。
     * OKなら [lowerKey, val] を返し、NGなら null を返します。
     */
    function validateEntry(key: unknown, val: unknown, logWarning = true): [string, string] | null {
        if (!key || typeof key !== 'string') {
            if (logWarning) {
                console.warn(`[TtsNormalizer] 不正なキーを無視します (文字列以外): "${key}"`);
            }
            return null;
        }

        const trimmedKey = key.trim();
        const lowerKey = trimmedKey.toLowerCase();

        if (!lowerKey || lowerKey.length > 64) {
            if (logWarning) {
                console.warn(`[TtsNormalizer] 不正なキーを無視します (空または64文字超): "${key}"`);
            }
            return null;
        }

        if (typeof val !== 'string' || val.length === 0 || val.length > 256) {
            if (logWarning) {
                console.warn(`[TtsNormalizer] 不正な値を無視します (文字列以外、空文字、または256文字超): キー="${key}"`);
            }
            return null;
        }

        // 値の文字種制限チェック
        if (!isValidDictValue(val)) {
            if (logWarning) {
                console.warn(`[TtsNormalizer] 許可されていない文字が含まれる値を無視します (英数字/記号不可): キー="${key}", 値="${val}"`);
            }
            return null;
        }

        return [lowerKey, val];
    }

    /**
     * 辞書データの検証とマージを行います。
     * キーは小文字化およびトリムされてマージされます。
     */
    function mergeAndValidateDicts(customDict: Record<string, string> = {}): Record<string, string> {
        const merged: Record<string, string> = {};
        
        // 信頼レイヤ（件数上限なし・後勝ち）
        const trustedLayers = [
            defaultDict,
            itOverrides as Record<string, string>,
            customOverrides as Record<string, string>
        ];

        for (const layer of trustedLayers) {
            if (!layer || typeof layer !== 'object') continue;
            for (const [k, v] of Object.entries(layer)) {
                const entry = validateEntry(k, v);
                if (entry) {
                    merged[entry[0]] = entry[1];
                }
            }
        }

        // customDict（信頼しない入力・1,000件上限を適用）
        if (customDict && typeof customDict === 'object') {
            let count = 0;
            let ignoredCount = 0;
            for (const [k, v] of Object.entries(customDict)) {
                if (count >= 1000) {
                    console.warn('[TtsNormalizer] customDict のエントリ数が上限(1000)を超えたため以降を無視します。');
                    break;
                }
                count++; // 検証の成否を問わず、走査したエントリ数を先にカウント
                const entry = validateEntry(k, v, false);
                if (entry) {
                    merged[entry[0]] = entry[1];
                } else {
                    ignoredCount++;
                }
            }
            if (ignoredCount > 0) {
                console.warn(`[TtsNormalizer] customDict の無効なエントリ ${ignoredCount} 件を無視しました。`);
            }
        }

        return merged;
    }

    /**
     * 正規表現とMapの構築・キャッシュを行います。
     */
    function updateCache(mergedDict: Record<string, string>) {
        cachedMultiWordMap.clear();
        cachedSingleWordMap.clear();

        const multiWordKeys: string[] = [];
        let multiWordCount = 0;

        for (const [lowerKey, val] of Object.entries(mergedDict)) {
            // mergedDict のキーはすでに小文字化・トリムされている
            if (lowerKey.includes(' ') || lowerKey.includes('\t')) {
                if (multiWordCount >= 200) {
                    console.warn(`[TtsNormalizer] 複数語キー数が上限（200）を超えたため、無視します: "${lowerKey}"`);
                    continue;
                }
                multiWordKeys.push(lowerKey);
                cachedMultiWordMap.set(lowerKey, val);
                multiWordCount++;
            } else {
                cachedSingleWordMap.set(lowerKey, val);
            }
        }

        // 複数語キーは長い順にソート（最長一致）
        multiWordKeys.sort((a, b) => b.length - a.length);

        // 正規表現の組み立て
        let patternStr = '';
        if (multiWordKeys.length > 0) {
            const escapedMulti = multiWordKeys.map(escapeRegExp).join('|');
            patternStr = `(?<![a-zA-Z0-9])(?:${escapedMulti})(?![a-zA-Z0-9])|`;
        }
        patternStr += `[a-zA-Z][a-zA-Z0-9+#.'-]*`;

        cachedRegex = new RegExp(patternStr, 'gi');
        lastMergedDict = mergedDict;
    }

    /**
     * TTS向けにテキストを正規化（マークダウン除去、日付変換、時刻変換、英単語カタカナ置換）します。
     */
    function normalizeTextForTts(text: string, customDict?: Record<string, string>): string {
        if (!text) return '';

        let cleanText = text;

        // 1. マークダウンマーカー除去
        cleanText = cleanText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // リンク [表示](url) -> 表示
        cleanText = cleanText.replace(/\*\*([^*]+)\*\*/g, '$1');       // **bold** -> bold
        cleanText = cleanText.replace(/__([^_]+)__/g, '$1');           // __bold__ -> bold
        cleanText = cleanText.replace(/`([^`]+)`/g, '$1');             // `code` -> code
        cleanText = cleanText.replace(/~~([^~]+)~~/g, '$1');           // ~~strike~~ -> strike

        // 2. 日付変換 (月: 1-12, 日: 1-31)
        // 年月日 (スラッシュ区切り)
        cleanText = cleanText.replace(/(?<![\d/／])(\d{4})[/／](\d{1,2})[/／](\d{1,2})(?![\d/／])/g, (match, y, m, d) => {
            const month = parseInt(m, 10);
            const day = parseInt(d, 10);
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                return `${parseInt(y, 10)}年${month}月${day}日`;
            }
            return match;
        });

        // 年月日 (ハイフン区切り - 年付きのみ)
        cleanText = cleanText.replace(/(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/g, (match, y, m, d) => {
            const month = parseInt(m, 10);
            const day = parseInt(d, 10);
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                return `${parseInt(y, 10)}年${month}月${day}日`;
            }
            return match;
        });

        // 月日 (スラッシュ区切り)
        cleanText = cleanText.replace(/(?<![\d/／])(\d{1,2})[/／](\d{1,2})(?![\d/／])/g, (match, m, d) => {
            const month = parseInt(m, 10);
            const day = parseInt(d, 10);
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                return `${month}月${day}日`;
            }
            return match;
        });

        // 3. 時刻変換 (分: 00-59, 時: 0-23)
        cleanText = cleanText.replace(/(?<![\d:：.])(\d{1,2})[:：](\d{2})(?![:：\d])/g, (match, h, m) => {
            const hour = parseInt(h, 10);
            const minute = parseInt(m, 10);
            if (minute >= 0 && minute <= 59 && hour >= 0 && hour <= 23) {
                if (minute === 0) {
                    return `${hour}時`;
                }
                return `${hour}時${minute}分`;
            }
            return match;
        });

        // 4. 英単語カタカナ置換
        const merged = mergeAndValidateDicts(customDict);
        if (!cachedRegex || !areObjectsEqual(lastMergedDict, merged)) {
            updateCache(merged);
        }

        if (cachedRegex) {
            cleanText = cleanText.replace(cachedRegex, (match) => {
                const lowerMatch = match.toLowerCase();
                
                // (1) 複数語キーのマッチチェック
                if (cachedMultiWordMap.has(lowerMatch)) {
                    return cachedMultiWordMap.get(lowerMatch)!;
                }

                // (2) 単語キーのチェック
                if (cachedSingleWordMap.has(lowerMatch)) {
                    return cachedSingleWordMap.get(lowerMatch)!;
                }

                // 末尾の記号 [.'-]+ を取り除いた部分での再チェック
                const suffixMatch = match.match(/[.'-]+$/);
                if (suffixMatch) {
                    const suffix = suffixMatch[0];
                    const stem = match.slice(0, -suffix.length);
                    const lowerStem = stem.toLowerCase();
                    if (cachedSingleWordMap.has(lowerStem)) {
                        return cachedSingleWordMap.get(lowerStem)! + suffix;
                    }
                }

                return match;
            });
        }

        return cleanText;
    }

    return {
        normalizeTextForTts
    };
}

// モジュール標準の normalizeTextForTts
export const { normalizeTextForTts } = createTtsNormalizer();

/**
 * 残留したアスタリスク文字のみを除去します。
 */
export function stripResidualAsterisks(text: string): string {
    if (!text) return '';
    return text.replace(/\*/g, '');
}
