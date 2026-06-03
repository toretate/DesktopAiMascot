import { Emotion } from './expression-service';
import fs from "fs";
import yaml from 'js-yaml';

type Prompts = {
    "common": string,
    "user-template-base": string,
    "labels": string,
    "analyze-sprite-sheet": string
}

// Prompt文を読み込む
function loadPrompts(): Prompts {
    const prompts = yaml.load(fs.readFileSync('src/skills/expression-service/prompt.yaml', 'utf8'));
    return prompts as Prompts;
}


export class GeminiExpressionEngine {
    private static geminiModel = 'gemini-3.1-flash-lite';



    /**
     * Gemini ネイティブ画像生成 (Nano Banana)
     */
    static async generateNativeImage(
        model: string,
        apiKey: string,
        emotions: Emotion[],
        userPromptTemplate: string,
        rawBase64: string,
        mimeType: string,
        history?: any[]
    ) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const emotionsLabels = emotions.map(e => e.label).join(', ');

        // プロンプトの生成
        const prompts = loadPrompts();
        const basePrompt = prompts.['common'];
        const userPrompt = userPromptTemplate.replace("__EMOTIONS_LABLE__", emotionsLabels);
        const labelInstruction = prompts.labels.replace("__EMOTION_LABELS", emotionsLabels);
        const finalPrompt = `${basePrompt} ${userPrompt} ${labelInstruction}`;

        const contents = [];
        if (history && history.length > 0) contents.push(...history);

        const parts: any[] = [{ text: finalPrompt }];
        if (rawBase64) parts.push({ inline_data: { mime_type: mimeType, data: rawBase64 } });
        contents.push({ role: 'user', parts });

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
                })
            });

            if (!response.ok) throw new Error(`Gemini API Error: ${response.status}`);
            const data: any = await response.json();
            const resParts = data.candidates?.[0]?.content?.parts || [];
            const imagePart = resParts.find((p: any) => p.inlineData);

            if (imagePart) {
                return {
                    success: true,
                    imageBytes: `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`,
                    history: data.candidates?.[0]?.content
                };
            }
            throw new Error('No image generated');
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Imagen (Google Cloud / AI Studio) による生成
     */
    static async generateImagenImage(prompt: string, model: string, apiKey: string) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instances: [{ prompt }],
                    parameters: { sampleCount: 1, outputMimeType: 'image/png', aspectRatio: '1:1' }
                })
            });
            if (!response.ok) throw new Error(`Imagen Error: ${response.status}`);
            const data: any = await response.json();
            return { success: true, imageBytes: `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}` };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    /**
     * 利用可能なモデルリストを取得
     */
    static async getModels(apiKey: string) {
        const defaultModels = [
            'gemini-3.1-flash-image', 'gemini-3-pro-image', 'gemini-2.5-flash-image',
            'imagen-3.0-generate-002', 'imagen-3.0-generate-001'
        ];
        if (!apiKey) return defaultModels;

        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        try {
            const response = await fetch(url);
            if (!response.ok) return defaultModels;
            const data: any = await response.json();
            const models = (data.models || [])
                .filter((m: any) =>
                    // Imagenモデル (predictサポート) または Native Imageモデル (generateContentサポート)
                    (m.name.includes('imagen') && m.supportedGenerationMethods?.includes('predict')) ||
                    (m.name.includes('image') && m.supportedGenerationMethods?.includes('generateContent'))
                )
                .map((m: any) => m.name.replace('models/', ''));

            // デフォルトモデルと取得したモデルをマージ（重複排除）
            return Array.from(new Set([...defaultModels, ...models]));
        } catch (e) {
            return defaultModels;
        }
    }

    /**
     * Gemini Visionによるスプライトシート解析
     */
    static async analyzeSpriteSheet(base64Image: string, apiKey: string) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${apiKey}`;
        const rawBase64 = base64Image.split(',')[1] || base64Image;
        const prompts = loadPrompts();
        const prompt = prompts['analyze-sprite-sheet'];

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: 'image/png', data: rawBase64 } }
                        ]
                    }],
                    generationConfig: { response_mime_type: "application/json" }
                })
            });
            if (!response.ok) throw new Error(`Vision API Error: ${response.status}`);
            const data: any = await response.json();
            return JSON.parse(data.candidates[0].content.parts[0].text);
        } catch (e: any) {
            return { error: e.message };
        }
    }
}
