import { MascotImageSet, MascotAsset } from "./MascotImageSet";

/**
 * 画像ファイル名やアセット配列から MascotImageSet を構築するビルダー
 */
export class MascotImageSetBuilder {
    private static readonly AngleSuffixes = new Set<string>([
        "left", "right", "front", "back", "top", "bottom", "above", "below", "behind"
    ]);

    private static readonly FullbodyTokens = new Set<string>([
        "fullbody", "body"
    ]);

    /**
     * アセットのリストから MascotImageSet を構築する
     * @param mascotName マスコット名
     * @param assets アセットの配列
     */
    public static CreateFromAssets(mascotName: string, assets: MascotAsset[]): MascotImageSet {
        const imageSet = new MascotImageSet(mascotName);

        for (const asset of assets) {
            if (!asset) {
                continue;
            }

            const fileName = this.getFileNameWithoutExtension(asset.path || asset.id);
            if (!fileName) {
                // ファイル名が取得できない場合（Data URLなど）、フォールバックとして id または name を解析
                this.parseAndAssign(asset, asset.id || asset.name, imageSet);
                continue;
            }

            if (fileName.toLowerCase() === "cover") {
                continue;
            }

            this.parseAndAssign(asset, fileName, imageSet);
        }

        return imageSet;
    }

    private static parseAndAssign(asset: MascotAsset, parseString: string, imageSet: MascotImageSet) {
        const parsed = this.parseFileName(parseString);

        switch (parsed.kind) {
            case "Angle":
                imageSet.angleImages[parsed.key] = asset;
                break;

            case "EmotionFace":
                imageSet.emotionFaceImages[parsed.key] = asset;
                break;

            case "EmotionFullbody":
                imageSet.emotionFullbodyImages[parsed.key] = asset;
                break;

            default:
                imageSet.image = asset;
                break;
        }
    }

    private static getFileNameWithoutExtension(pathStr: string): string {
        if (!pathStr || pathStr.startsWith("data:")) {
            return "";
        }
        // URL またはファイルパスからファイル名を取り出す
        const base = pathStr.split(/[\\/]/).pop() || pathStr;
        const dotIndex = base.lastIndexOf(".");
        return dotIndex === -1 ? base : base.substring(0, dotIndex);
    }

    private static parseFileName(fileName: string): { kind: "Main" | "Angle" | "EmotionFace" | "EmotionFullbody"; key: string } {
        const tokens = fileName.split("_").map(t => t.trim()).filter(t => t.length > 0);
        if (tokens.length === 0) {
            return { kind: "Main", key: "" };
        }

        const lastToken = tokens[tokens.length - 1];
        if (this.AngleSuffixes.has(lastToken.toLowerCase()) && tokens.length >= 2) {
            return { kind: "Angle", key: lastToken.toLowerCase() };
        }

        const parsedEmotion = this.tryParseEmotion(tokens);
        if (parsedEmotion) {
            return parsedEmotion;
        }

        return { kind: "Main", key: "" };
    }

    private static tryParseEmotion(tokens: string[]): { kind: "EmotionFace" | "EmotionFullbody"; key: string } | null {
        if (tokens.length < 3) {
            return null;
        }

        const lastToken = tokens[tokens.length - 1].toLowerCase();
        const prevToken = tokens[tokens.length - 2].toLowerCase();

        if (prevToken === "face") {
            return { kind: "EmotionFace", key: lastToken };
        }

        if (lastToken === "face") {
            return { kind: "EmotionFace", key: prevToken };
        }

        if (this.FullbodyTokens.has(prevToken)) {
            return { kind: "EmotionFullbody", key: lastToken };
        }

        if (this.FullbodyTokens.has(lastToken)) {
            return { kind: "EmotionFullbody", key: prevToken };
        }

        return null;
    }
}
