export interface MascotAsset {
    id: string;
    name: string;
    path: string;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
}

/**
 * マスコット画像セットを表すクラス
 */
export class MascotImageSet {
    /** 画像セットの名前。所属する各画像のベース名となる */
    public name: string;

    /** この画像セットの代表画像 */
    public image: MascotAsset | null = null;

    /** 各角度の画像。Key: left, right, front, back, top, bottom 等 */
    public angleImages: Record<string, MascotAsset> = {};

    /** 各感情の表情画像（顔のみ）。Key: joy, sadness, anger など28種類 */
    public emotionFaceImages: Record<string, MascotAsset> = {};

    /** 各感情の全身画像。Key: joy, sadness, anger など28種類 */
    public emotionFullbodyImages: Record<string, MascotAsset> = {};

    constructor(name: string) {
        this.name = name;
    }

    /**
     * チャット表示用の正面画像を返す
     */
    public getFrontImage(): MascotAsset | null {
        if (this.angleImages["front"]) {
            return this.angleImages["front"];
        }

        return this.image ?? this.getPreferredAngleImage();
    }

    /**
     * 感情に対応する顔画像を返す
     */
    public getEmotionFaceImage(emotion?: string | null): MascotAsset | null {
        if (!emotion) {
            return null;
        }

        const key = emotion.trim().toLowerCase();
        if (key.length === 0) {
            return null;
        }

        return this.emotionFaceImages[key] || null;
    }

    /**
     * 感情に対応する全身画像を返す
     */
    public getEmotionFullbodyImage(emotion?: string | null): MascotAsset | null {
        if (!emotion) {
            return null;
        }

        const key = emotion.trim().toLowerCase();
        if (key.length === 0) {
            return null;
        }

        return this.emotionFullbodyImages[key] || null;
    }

    /**
     * 指定方向の画像を返す
     */
    public getAngleImage(angle?: string | null): MascotAsset | null {
        if (!angle) {
            return null;
        }

        const key = angle.trim().toLowerCase();
        if (key.length === 0) {
            return null;
        }

        return this.angleImages[key] || null;
    }

    /**
     * 表示用の代表画像を返す
     */
    public getPrimaryImage(): MascotAsset | null {
        const frontImage = this.getFrontImage();
        if (frontImage) {
            return frontImage;
        }

        const firstFace = Object.values(this.emotionFaceImages)[0];
        if (firstFace) {
            return firstFace;
        }

        const firstFullbody = Object.values(this.emotionFullbodyImages)[0];
        if (firstFullbody) {
            return firstFullbody;
        }

        return null;
    }

    /**
     * このセットに属する全画像を重複なく返す
     */
    public getAllImages(): MascotAsset[] {
        const seenPaths = new Set<string>();
        const result: MascotAsset[] = [];

        const addIfUnique = (item: MascotAsset | null) => {
            if (item && !seenPaths.has(item.path)) {
                seenPaths.add(item.path);
                result.push(item);
            }
        };

        addIfUnique(this.image);

        for (const item of Object.values(this.angleImages)) {
            addIfUnique(item);
        }

        for (const item of Object.values(this.emotionFaceImages)) {
            addIfUnique(item);
        }

        for (const item of Object.values(this.emotionFullbodyImages)) {
            addIfUnique(item);
        }

        return result;
    }

    private getPreferredAngleImage(): MascotAsset | null {
        const preferredOrder = ["front", "left", "right", "back", "top", "bottom", "above", "below", "behind"];
        for (const key of preferredOrder) {
            if (this.angleImages[key]) {
                return this.angleImages[key];
            }
        }

        const keys = Object.keys(this.angleImages);
        if (keys.length > 0) {
            return this.angleImages[keys[0]];
        }

        return null;
    }
}
