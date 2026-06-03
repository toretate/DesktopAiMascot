import fs from "fs";
import yaml from 'js-yaml';
import { GeminiExpressionEngine } from './expression-create-gemini';

/*
キャラクターの一貫性を保ってください。
添付した画像を参照して、チャットマスコットとして必要な様々な表情を作成してください。
作成する表情は以下の通りです：
[EMOTIONS]
背景は純白(#ffffff)にしてください。顔のアップで、各画像間はプログラム処理しやすいように黒の直線で区切ってください。また、各画像の下に対応する表情のラベルを表示してください。
*/

export interface Emotion {
    name: string;
    label: string;
}

/**
 * 外部依存関係（Node.jsモジュール等）のインターフェース
 */
export interface AiExpressionPlatformAdapter {
    readFileSync: (path: string) => { toString: (encoding: string) => string };
    existsSync: (path: string) => boolean;
    pathJoin: (...args: string[]) => string;
    pathExtname: (path: string) => string;
    cwd: () => string;
}

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

/**
 * 表情スプライト生成クラス
 */
export class AiExpressionService {
    private static adapter: AiExpressionPlatformAdapter | null = null;

    /**
     * プラットフォーム固有のアダプターを設定
     */
    static setAdapter(adapter: AiExpressionPlatformAdapter) {
        this.adapter = adapter;
    }

    /**
     * AIによる表情スプライト生成のメインロジック
     * 
     * @param base64Image キャラクターの画像（base64形式）
     * @param apiKey API KEY
     * @param emotions 生成する表情のリスト
     * @param userPromptTemplate ユーザーが入力したプロンプト
     * @param engine 生成エンジン
     * @param model モデル
     * @param history チャット履歴
     * @param openaiApiKey OpenAI API KEY
     */
    static async generateExpressions(
        base64Image: string,
        apiKey: string,
        emotions: Emotion[],
        userPromptTemplate: string,
        engine?: string,
        model?: string,
        history?: any[],
        openaiApiKey?: string
    ) {
        const currentEngine = engine || 'gemini';
        const targetModel = model || '';

        // Native Image Models (Nano Banana series)
        const isNativeImageModel = targetModel.includes('flash-image') || targetModel.includes('pro-image') || targetModel.includes('banana');

        // 画像の読み込みとデコード
        const { rawBase64, mimeType } = await this.resolveImage(base64Image);

        // --- Native Image Model Path (Nano Banana / text-and-image-to-image) ---
        if (currentEngine === 'gemini' && isNativeImageModel) {
            return await GeminiExpressionEngine.generateNativeImage(targetModel, apiKey, emotions, userPromptTemplate, rawBase64, mimeType, history);
        }

        // 1. プロンプトの作成
        const prompts = loadPrompts();

        // 表情プロンプトを作成
        const emotionsLabels = emotions.map(e => e.label).join(', ');
        const labelInstruction = prompts.labels.replace("__EMOTION_LABELS", emotionsLabels);

        // プロンプト作成
        const finalPrompt = `${prompts.common} ${userPromptTemplate} ${labelInstruction}`;
        console.log(`[AiExpressionService] Engine: ${currentEngine}`);

        // 2 生成エンジン毎に画像を生成
        if (currentEngine === 'openai') {
            return await this.generateOpenAiImage(finalPrompt, targetModel, openaiApiKey);
        } else if (currentEngine === 'comfyui') {
            return await this.generateComfyUiImage(finalPrompt, targetModel);
        } else if (currentEngine === 'ollama') {
            return { success: false, error: `Ollama (${targetModel || 'llava'}) is not an image model.` };
        } else {
            // 標準は Gemini 
            const models = await GeminiExpressionEngine.getModels(apiKey);
            const finalModel = targetModel || models.find(m => m.includes('imagen')) || 'imagen-3.0-generate-002';
            return await GeminiExpressionEngine.generateImagenImage(finalPrompt, finalModel, apiKey);
        }
    }

    /**
     * 画像パスまたはURLからBase64データを解決する
     */
    private static async resolveImage(base64Image: string) {
        let rawBase64 = '';
        let mimeType = 'image/png';

        if (!base64Image) return { rawBase64, mimeType };

        if (base64Image.startsWith('data:')) {
            rawBase64 = base64Image.split(',')[1] || base64Image;
            mimeType = base64Image.split(';')[0]?.split(':')[1] || 'image/png';
        } else if (base64Image.startsWith('http://') || base64Image.startsWith('https://')) {
            try {
                const response = await fetch(base64Image);
                const arrayBuffer = await response.arrayBuffer();
                // ブラウザ互換のBase64エンコード
                const binary = String.fromCharCode(...new Uint8Array(arrayBuffer));
                rawBase64 = btoa(binary);
                mimeType = response.headers.get('content-type') || 'image/png';
            } catch (e) {
                console.warn('[AiExpressionService] URL fetch failed:', e);
            }
        } else if (this.adapter) {
            try {
                let filePath = base64Image;
                if (filePath.startsWith('file:///')) {
                    filePath = decodeURIComponent(filePath.replace('file:///', ''));
                }
                if (filePath.startsWith('/mascots/')) {
                    filePath = this.adapter.pathJoin(this.adapter.cwd(), filePath);
                }
                if (this.adapter.existsSync(filePath)) {
                    const fileData = this.adapter.readFileSync(filePath);
                    rawBase64 = fileData.toString('base64');
                    const ext = this.adapter.pathExtname(filePath).toLowerCase();
                    if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
                    else if (ext === '.gif') mimeType = 'image/gif';
                    else if (ext === '.webp') mimeType = 'image/webp';
                }
            } catch (e) {
                console.warn('[AiExpressionService] File read failed:', e);
            }
        }
        return { rawBase64, mimeType };
    }

    /**
     * 利用可能なImagenモデルリストを取得
     */
    static async getImagenModels(apiKey: string) {
        return await GeminiExpressionEngine.getModels(apiKey);
    }

    /**
     * Gemini Visionによるスプライトシート解析
     */
    static async analyzeSpriteSheet(base64Image: string, apiKey: string) {
        return await GeminiExpressionEngine.analyzeSpriteSheet(base64Image, apiKey);
    }

    /**
     * OpenAI DALL-E による生成
     */
    private static async generateOpenAiImage(prompt: string, model: string, apiKey?: string) {
        if (!apiKey) return { success: false, error: 'OpenAI API key is missing' };
        const url = 'https://api.openai.com/v1/images/generations';
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model || 'dall-e-3',
                    prompt: prompt,
                    n: 1,
                    size: '1024x1024',
                    response_format: 'b64_json'
                })
            });
            if (!response.ok) throw new Error(`OpenAI Error: ${response.status}`);
            const data: any = await response.json();
            return { success: true, imageBytes: `data:image/png;base64,${data.data[0].b64_json}` };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    /**
     * ComfyUI による生成
     */
    private static async generateComfyUiImage(prompt: string, model: string) {
        const [nodeId, fieldKey] = (model || '29:40').split(':');
        const url = 'http://127.0.0.1:8188/prompt';
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: {
                        [nodeId || '29']: {
                            class_type: "CLIPTextEncode",
                            inputs: { [fieldKey === '40' ? 'text' : (fieldKey || 'text')]: prompt }
                        }
                    }
                })
            });
            return response.ok
                ? { success: false, error: 'Workflow submitted. Check ComfyUI output folder.' }
                : { success: false, error: `ComfyUI Error: ${response.status}` };
        } catch (e: any) {
            return { success: false, error: 'ComfyUI connection failed' };
        }
    }
}
