import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { PYTHON_DIR, resolveMascotPath, PROJECT_ROOT } from './paths';
import { uploadImage, runWorkflow } from './comfy-connector';

const execFileAsync = promisify(execFile);

const PYTHON_BIN = process.env.REMBG_PYTHON
    ?? path.join(PYTHON_DIR, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');

const NOFACE_SCRIPT = path.join(PYTHON_DIR, 'generate_noface.py');
const RETOUCH_SCRIPT = path.join(PYTHON_DIR, 'retouch.py');

function resolveImagePath(imagePath: string): string {
    if (imagePath.startsWith('/mascots/')) {
        return resolveMascotPath(imagePath);
    }
    return imagePath;
}

/**
 * のっぺらぼう画像を自動生成する。
 */
async function generateNofaceWithComfyUI(inputPath: string, outputPath: string, prompt: string): Promise<string> {
    const absInput = resolveImagePath(inputPath);
    const absOutput = resolveImagePath(outputPath);

    const imageBuffer = fs.readFileSync(absInput);
    const ext = path.extname(absInput).substring(1) || 'png';
    const filename = `noface_in_${Date.now()}.${ext}`;

    // 1. 画像アップロード
    const uploadedFileName = await uploadImage(imageBuffer, filename);

    // 2. ワークフローの書き換え
    const workflowPath = path.join(PROJECT_ROOT, 'aiservice/image/comfy_workflows/qwen3_image_edit_workflow.json');
    if (!fs.existsSync(workflowPath)) {
        throw new Error(`Workflow template not found at ${workflowPath}`);
    }
    const workflowJson = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

    if (workflowJson['41'] && workflowJson['41'].inputs) {
        workflowJson['41'].inputs.image = uploadedFileName;
    }
    if (workflowJson['89:68'] && workflowJson['89:68'].inputs) {
        workflowJson['89:68'].inputs.prompt = prompt;
    }

    // 3. 実行して保存
    console.log(`[ComfyUI] Running Inpainting workflow for noface generation with prompt: ${prompt}`);
    const resultBuffer = await runWorkflow(workflowJson);
    fs.writeFileSync(absOutput, resultBuffer);

    return outputPath;
}

async function generateNofaceWithGemini(
    inputPath: string,
    outputPath: string,
    prompt: string,
    apiKey: string
): Promise<string> {
    const absInput = resolveImagePath(inputPath);
    const absOutput = resolveImagePath(outputPath);

    const imageBuffer = fs.readFileSync(absInput);
    const rawBase64 = imageBuffer.toString('base64');
    const mimeType = 'image/png';

    const model = 'gemini-3.1-flash-image';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const contents = [{
        role: 'user',
        parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: rawBase64 } }
        ]
    }];

    console.log(`[Gemini] Requesting noface generation with model ${model} and prompt: ${prompt}`);
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            generationConfig: { responseModalities: ["IMAGE"] }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    const resParts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = resParts.find((p: any) => p.inlineData);

    if (!imagePart) {
        throw new Error('Gemini did not return any image data.');
    }

    const resultBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
    fs.writeFileSync(absOutput, resultBuffer);

    return outputPath;
}

/**
 * のっぺらぼう画像を自動生成する。
 */
export async function generateNofaceImage(
    inputPath: string,
    outputPath: string,
    detectMode = 'ai',
    engine = 'mediapipe',
    prompt = '',
    geminiApiKey = ''
): Promise<string> {
    const absInput = resolveImagePath(inputPath);
    const absOutput = resolveImagePath(outputPath);

    // 出力先ディレクトリの確保
    fs.mkdirSync(path.dirname(absOutput), { recursive: true });

    if (!fs.existsSync(absInput)) {
        throw new Error(`Input image not found: ${absInput}`);
    }

    if (engine === 'comfy') {
        return await generateNofaceWithComfyUI(inputPath, outputPath, prompt || 'Remove eyes, eyebrows, mouth, and nose from the face, making the face completely blank/faceless. Keep all other parts like hair, clothes, and outline exactly the same.');
    } else if (engine === 'gemini') {
        if (!geminiApiKey) {
            throw new Error('Gemini API Key is required for Gemini engine');
        }
        return await generateNofaceWithGemini(inputPath, outputPath, prompt || '目、眉、口、鼻を完全に消去し、周囲の肌色と滑らかに馴染ませた「のっぺらぼう」の顔にしてください。髪や輪郭、服、ポーズ、背景などは一切変更せず、完全に元のままとし、顔のパーツ（目・眉・口・鼻）の領域だけを周囲の肌色で自然に埋めてください。最終的な画像のみを出力してください。', geminiApiKey);
    }

    // 従来の MediaPipe / OpenCV を使用した画像処理
    const { stdout } = await execFileAsync(
        PYTHON_BIN,
        [NOFACE_SCRIPT, absInput, absOutput, '--mode', detectMode],
        { timeout: 30_000 }
    );

    const result = JSON.parse(stdout.trim()) as { success: boolean; outputPath?: string; error?: string };
    if (!result.success || result.error) {
        throw new Error(`generate_noface failed: ${result.error}`);
    }

    return outputPath;
}

/**
 * 手動レタッチを適用する。
 */
export async function applyRetouch(
    inputPath: string,
    outputPath: string,
    tool: 'brush' | 'eraser',
    x: number,
    y: number,
    radius: number
): Promise<string> {
    const absInput = resolveImagePath(inputPath);
    const absOutput = resolveImagePath(outputPath);

    fs.mkdirSync(path.dirname(absOutput), { recursive: true });

    if (!fs.existsSync(absInput)) {
        throw new Error(`Input image not found: ${absInput}`);
    }

    const { stdout } = await execFileAsync(
        PYTHON_BIN,
        [RETOUCH_SCRIPT, absInput, absOutput, tool, String(x), String(y), String(radius)],
        { timeout: 10_000 }
    );

    const result = JSON.parse(stdout.trim()) as { success: boolean; outputPath?: string; error?: string };
    if (!result.success || result.error) {
        throw new Error(`retouch failed: ${result.error}`);
    }

    return outputPath;
}

const ALIGN_SCRIPT = path.join(PYTHON_DIR, 'align_expression.py');

/**
 * のっぺらぼう画像と表情パーツ自動位置合わせを行う。
 */
export async function alignExpression(
    basePath: string,
    expressionPath: string,
    detectMode = 'ai'
): Promise<{ success: boolean; offsetX: number; offsetY: number; scale: number; exprMidX: number; exprMidY: number; exprOvalCX: number; exprOvalCY: number; exprEyeDist: number; exprOvalW: number; baseWidth?: number; baseHeight?: number; exprWidth?: number; exprHeight?: number; error?: string }> {
    const absBase = resolveImagePath(basePath);
    const absExpr = resolveImagePath(expressionPath);

    if (!fs.existsSync(absBase)) {
        throw new Error(`Base image not found: ${absBase}`);
    }
    if (!fs.existsSync(absExpr)) {
        throw new Error(`Expression image not found: ${absExpr}`);
    }

    const { stdout } = await execFileAsync(
        PYTHON_BIN,
        [ALIGN_SCRIPT, '--base', absBase, '--expression', absExpr, '--mode', detectMode],
        { timeout: 30_000 }
    );

    const result = JSON.parse(stdout.trim());
    return result;
}

const DETECT_FACE_SCRIPT = path.join(PYTHON_DIR, 'detect_base_face.py');

/**
 * 元の立ち絵画像から顔領域を自動検出する。
 */
export async function detectBaseFace(
    imagePath: string,
    detectMode = 'ai'
): Promise<{ success: boolean; fallback: boolean; faceX: number; faceY: number; faceWidth: number; faceHeight: number; baseWidth: number; baseHeight: number; error?: string }> {
    const absPath = resolveImagePath(imagePath);

    if (!fs.existsSync(absPath)) {
        throw new Error(`Target image not found: ${absPath}`);
    }

    const { stdout } = await execFileAsync(
        PYTHON_BIN,
        [DETECT_FACE_SCRIPT, '--image', absPath, '--mode', detectMode],
        { timeout: 30_000 }
    );

    const result = JSON.parse(stdout.trim());
    return result;
}
