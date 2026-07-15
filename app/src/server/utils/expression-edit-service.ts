import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { PYTHON_DIR, resolveMascotPath, PROJECT_ROOT } from './paths';
import { buildOutfitNofacePath } from '../../utils/mascot-noface';
import { uploadImage, runJsonWorkflow, runWorkflow } from './comfy-connector';

const execFileAsync = promisify(execFile);

const PYTHON_BIN = process.env.REMBG_PYTHON
    ?? path.join(PYTHON_DIR, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');

const NOFACE_SCRIPT = path.join(PYTHON_DIR, 'generate_noface.py');
const NORMALIZE_NOFACE_SCRIPT = path.join(PYTHON_DIR, 'normalize_noface.py');
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
    geminiApiKey = '',
    force = true
): Promise<string> {
    const absInput = resolveImagePath(inputPath);
    const absOutput = resolveImagePath(outputPath);

    // すでにのっぺらぼう画像が存在し、かつ強制再生成でない場合は既存の画像をそのまま使う
    if (!force && fs.existsSync(absOutput)) {
        console.log(`[Server] Existing noface image found at ${absOutput}, skipping generation.`);
        return outputPath;
    }

    // 出力先ディレクトリの確保
    fs.mkdirSync(path.dirname(absOutput), { recursive: true });

    if (inputPath === '🤖' || !inputPath || !fs.existsSync(absInput)) {
        throw new Error('ベースとなる画像ファイルが見つかりません。マスコットの衣装やポーズ、またはアバターに有効な画像ファイルを設定してください。');
    }

    if (engine === 'comfy') {
        await generateNofaceWithComfyUI(inputPath, outputPath, prompt || 'Remove eyes, eyebrows, mouth, and nose from the face, making the face completely blank/faceless. Keep all other parts like hair, clothes, and outline exactly the same.');
    } else if (engine === 'gemini') {
        if (!geminiApiKey) {
            throw new Error('Gemini API Key is required for Gemini engine');
        }
        await generateNofaceWithGemini(inputPath, outputPath, prompt || '目、眉、口、鼻を完全に消去し、周囲の肌色と滑らかに馴染ませた「のっぺらぼう」の顔にしてください。髪や輪郭、服、ポーズ、背景などは一切変更せず、完全に元のままとし、顔のパーツ（目・眉・口・鼻）の領域だけを周囲の肌色で自然に埋めてください。最終的な画像のみを出力してください。', geminiApiKey);
    } else {
        // 従来の MediaPipe / OpenCV を使用した画像処理
        const pyMode = detectMode === 'comfy' ? 'ai' : detectMode;
        const { stdout } = await execFileAsync(
            PYTHON_BIN,
            [NOFACE_SCRIPT, absInput, absOutput, '--mode', pyMode],
            { timeout: 30_000 }
        );

        const result = JSON.parse(stdout.trim()) as { success: boolean; outputPath?: string; error?: string };
        if (!result.success || result.error) {
            throw new Error(`generate_noface failed: ${result.error}`);
        }
    }

    await normalizeNofaceImage(inputPath, outputPath);
    return outputPath;
}

export async function normalizeNofaceImage(sourcePath: string, nofacePath: string): Promise<void> {
    const absSource = resolveImagePath(sourcePath);
    const absNoface = resolveImagePath(nofacePath);
    const { stdout } = await execFileAsync(
        PYTHON_BIN,
        [NORMALIZE_NOFACE_SCRIPT, absSource, absNoface],
        { timeout: 30_000 }
    );
    const result = JSON.parse(stdout.trim()) as { success: boolean; error?: string };
    if (!result.success) throw new Error(`normalize_noface failed: ${result.error}`);
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
): Promise<{ success: boolean; offsetX: number; offsetY: number; scale: number; exprMidX: number; exprMidY: number; exprOvalCX: number; exprOvalCY: number; exprEyeDist: number; exprOvalW: number; baseWidth?: number; baseHeight?: number; exprWidth?: number; exprHeight?: number; fallback?: boolean; method?: string; error?: string }> {
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
): Promise<{ success: boolean; fallback: boolean; faceX: number; faceY: number; faceWidth: number; faceHeight: number; baseWidth: number; baseHeight: number; candidates?: any[]; error?: string }> {
    const absPath = resolveImagePath(imagePath);

    if (!fs.existsSync(absPath)) {
        throw new Error(`Target image not found: ${absPath}`);
    }

    const pythonMode = detectMode === 'comfy' ? 'ai' : detectMode;
    const { stdout } = await execFileAsync(
        PYTHON_BIN,
        [DETECT_FACE_SCRIPT, '--image', absPath, '--mode', pythonMode],
        { timeout: 30_000 }
    );

    const result = JSON.parse(stdout.trim());

    if (detectMode === 'comfy') {
        try {
            console.log('[ComfyUI] Detecting face on-demand...');
            const imageBuffer = fs.readFileSync(absPath);
            const ext = path.extname(absPath).substring(1) || 'png';
            const uploadFilename = `face_detect_${Date.now()}.${ext}`;
            const uploadedFileName = await uploadImage(imageBuffer, uploadFilename);

            const workflowPath = path.join(PROJECT_ROOT, 'docs/specs/comfyui-desktop-ai-mascot-tools/face_detection_api.json');
            if (!fs.existsSync(workflowPath)) {
                throw new Error(`Workflow template not found at ${workflowPath}`);
            }
            const workflowJson = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

            if (workflowJson['1'] && workflowJson['1'].inputs) {
                workflowJson['1'].inputs.image = uploadedFileName;
            }

            const detectionData = await runJsonWorkflow(workflowJson);
            const bbox = detectionData.face_bbox;
            if (bbox && bbox.w > 0 && bbox.h > 0) {
                result.faceX = bbox.x + bbox.w / 2.0;
                result.faceY = bbox.y + bbox.h / 2.0;
                result.faceWidth = bbox.w;
                result.faceHeight = bbox.h;
                result.fallback = false;
                result.method = 'comfy';
                result.candidates = [{
                    faceX: result.faceX,
                    faceY: result.faceY,
                    faceWidth: result.faceWidth,
                    faceHeight: result.faceHeight
                }];
                console.log('[ComfyUI] Face detection successful:', bbox);
            } else {
                console.log('[ComfyUI] Face detection returned no bbox. Using fallback.');
            }
        } catch (e: any) {
            console.warn('[ComfyUI] Face detection failed. Using Python-fallback:', e.message);
        }
    }

    return result;
}

const PACK_ATLAS_SCRIPT = path.join(PYTHON_DIR, 'pack_atlas.py');

/**
 * テクスチャアトラスをパッキングする。
 */
export async function packTextureAtlas(
    userId: string,
    mascotId: string,
    outfitId: string,
    partsList: Array<{ name: string; path: string; offsetX: number; offsetY: number }>
): Promise<{ success: boolean; atlasPath: string; jsonPath: string; width: number; height: number; error?: string }> {
    const mascotDir = path.dirname(resolveImagePath(buildOutfitNofacePath(mascotId, outfitId, userId)));
    
    // 一時JSONファイルを作成
    const tempPartsJsonPath = path.join(mascotDir, `temp_parts_${Date.now()}.json`);
    fs.writeFileSync(tempPartsJsonPath, JSON.stringify(partsList, null, 2), 'utf8');

    try {
        const { stdout } = await execFileAsync(
            PYTHON_BIN,
            [
                PACK_ATLAS_SCRIPT,
                '--mascot-dir',
                mascotDir,
                '--parts-json',
                tempPartsJsonPath,
                '--out-atlas',
                'atlas.png',
                '--out-json',
                'atlas.json'
            ],
            { timeout: 30_000 }
        );

        const result = JSON.parse(stdout.trim());
        return result;
    } finally {
        // 一時ファイルの削除
        if (fs.existsSync(tempPartsJsonPath)) {
            try {
                fs.unlinkSync(tempPartsJsonPath);
            } catch (e) {
                console.warn('[Server] Failed to clean up temp parts json:', e);
            }
        }
    }
}

const EXTRACT_PARTS_SCRIPT = path.join(PYTHON_DIR, 'extract_parts.py');

/**
 * 表情から目・眉・口のみの透過パーツを抽出・保存する。
 */
export async function extractExpressionParts(
    nofacePath: string,
    expressionPath: string,
    outputPath: string,
    offsetX: number,
    offsetY: number,
    scale: number,
    rotation: number,
    mode = 'xor',
    comfyJsonPath?: string
): Promise<{ success: boolean; outputPath: string; width: number; height: number; error?: string }> {
    const absNoface = resolveImagePath(nofacePath);
    const absExpr = resolveImagePath(expressionPath);
    const absOutput = resolveImagePath(outputPath);

    // ディレクトリ確保
    fs.mkdirSync(path.dirname(absOutput), { recursive: true });

    const pyArgs = [
        EXTRACT_PARTS_SCRIPT,
        '--noface', absNoface,
        '--expression', absExpr,
        '--output', absOutput,
        '--offset-x', String(offsetX),
        '--offset-y', String(offsetY),
        '--scale', String(scale),
        '--rotation', String(rotation),
        '--mode', mode
    ];

    if (mode === 'comfy' && comfyJsonPath) {
        pyArgs.push('--comfy-json', resolveImagePath(comfyJsonPath));
    }

    const { stdout } = await execFileAsync(
        PYTHON_BIN,
        pyArgs,
        { timeout: 30_000 }
    );

    const result = JSON.parse(stdout.trim());
    return result;
}
