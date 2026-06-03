import { describe, test, expect } from "vitest";
import { MascotImageSetBuilder } from "../MascotImageSetBuilder";
import { MascotImageSet, MascotAsset } from "../MascotImageSet";

describe("MascotImageSetBuilder", () => {
    test("CreateFromAssets_方向画像と表情画像をセット単位で分類できる", () => {
        const assets: MascotAsset[] = [
            createAsset("hero.png"),
            createAsset("hero_left.png"),
            createAsset("hero_right.png"),
            createAsset("hero_face_joy.png"),
            createAsset("hero_anger_fullbody.png"),
            createAsset("cover.png"),
        ];

        const heroSet = MascotImageSetBuilder.CreateFromAssets("hero", assets);

        expect(heroSet.image?.path).toBe("hero.png");
        expect(heroSet.angleImages["left"]?.path).toBe("hero_left.png");
        expect(heroSet.angleImages["right"]?.path).toBe("hero_right.png");
        expect(heroSet.emotionFaceImages["joy"]?.path).toBe("hero_face_joy.png");
        expect(heroSet.emotionFullbodyImages["anger"]?.path).toBe("hero_anger_fullbody.png");

        const allImages = heroSet.getAllImages();
        const hasCover = allImages.some(img => img.path === "cover.png");
        expect(hasCover).toBe(false);
    });

    test("GetPrimaryImage_代表画像が無い場合は角度画像をフォールバックする", () => {
        const imageSet = new MascotImageSet("hero");
        imageSet.angleImages["left"] = createAsset("hero_left.png");
        imageSet.angleImages["front"] = createAsset("hero_front.png");

        const primaryImage = imageSet.getPrimaryImage();

        expect(primaryImage).not.toBeNull();
        expect(primaryImage?.path).toBe("hero_front.png");
    });
});

function createAsset(fileName: string): MascotAsset {
    return {
        id: fileName,
        name: fileName,
        path: fileName
    };
}
