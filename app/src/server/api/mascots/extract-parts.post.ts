import { defineEventHandler, readBody, createError } from 'h3';
import { extractExpressionParts } from '../../utils/expression-edit-service';
import { resolveMascotPath, PROJECT_ROOT } from '../../utils/paths';
import { uploadImage, runJsonWorkflow } from '../../utils/comfy-connector';
import fs from 'fs';
import path from 'path';

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        const { nofacePath, expressionPath, outputPath, offsetX, offsetY, scale, rotation, mode } = body as {
            nofacePath?: string;
            expressionPath?: string;
            outputPath?: string;
            offsetX?: number;
            offsetY?: number;
            scale?: number;
            rotation?: number;
            mode?: 'xor' | 'comfy';
        };

        if (!nofacePath || !expressionPath || !outputPath) {
            throw createError({
                statusCode: 400,
                statusMessage: 'nofacePath, expressionPath, and outputPath are required'
            });
        }

        const currentMode = mode || 'xor';
        let comfyJsonPath: string | undefined = undefined;

        if (currentMode === 'comfy') {
            const absExprPath = resolveMascotPath(expressionPath);
            const absJsonPath = absExprPath.replace(/\.[^/.]+$/, '.json');
            
            // JSONが存在しない場合はComfyUIでオンデマンド生成
            if (!fs.existsSync(absJsonPath)) {
                console.log(`[Server] ComfyUI detection JSON not found for ${expressionPath}. Starting on-demand generation...`);
                
                if (!fs.existsSync(absExprPath)) {
                    throw new Error(`Expression image not found at ${absExprPath}`);
                }

                // 1. 画像の読み込みとアップロード
                const imageBuffer = fs.readFileSync(absExprPath);
                const ext = path.extname(absExprPath).substring(1) || 'png';
                const uploadFilename = `expr_detect_${Date.now()}.${ext}`;
                const uploadedFileName = await uploadImage(imageBuffer, uploadFilename);

                // 2. ワークフローテンプレートのロード
                const workflowPath = path.join(PROJECT_ROOT, 'docs/specs/comfyui-desktop-ai-mascot-tools/face_detection_api.json');
                if (!fs.existsSync(workflowPath)) {
                    throw new Error(`Workflow template not found at ${workflowPath}`);
                }
                const workflowJson = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

                // 3. 入力画像の書き換え (Node ID: '1')
                if (workflowJson['1'] && workflowJson['1'].inputs) {
                    workflowJson['1'].inputs.image = uploadedFileName;
                }

                // 4. ComfyUI ワークフローを実行して JSON 取得
                console.log('[Server] Dispatching ComfyUI workflow for face parts detection...');
                const detectionData = await runJsonWorkflow(workflowJson);

                // 5. ローカルに保存
                fs.writeFileSync(absJsonPath, JSON.stringify(detectionData, null, 4), 'utf8');
                console.log(`[Server] Successfully generated and cached comfy JSON at ${absJsonPath}`);
            }

            // 画像のディレクトリからの相対パス、または絶対パスとしてcomfyJsonPathを渡す
            // ここでは相対的なマスコットパス表現に合わせるか、直接絶対パスを渡す
            comfyJsonPath = absJsonPath;
        }

        console.log(`[Server] Extracting expression parts for ${expressionPath} with mode=${currentMode} offset=[${offsetX}, ${offsetY}] scale=${scale} rotation=${rotation}`);
        const result = await extractExpressionParts(
            nofacePath,
            expressionPath,
            outputPath,
            offsetX || 0,
            offsetY || 0,
            scale || 1.0,
            rotation || 0,
            currentMode,
            comfyJsonPath
        );

        if (!result.success) {
            throw new Error(result.error || 'Unknown error during extraction');
        }

        return {
            success: true,
            outputPath: outputPath,
            width: result.width,
            height: result.height
        };
    } catch (error: any) {
        console.error('[Server] extract-parts failed:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
