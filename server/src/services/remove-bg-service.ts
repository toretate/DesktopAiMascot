import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal-node';
import { uploadImage, runWorkflow } from '../connector/comfy-connector';
import { removeBackgroundToonOut } from './toonout-service';
import * as path from 'path';
import * as fs from 'fs';

// ComfyUIでの背景除去ヘルパー
async function removeBackgroundWithComfyUI(imageBuffer: Buffer, mimeType: string): Promise<Buffer> {
    const ext = mimeType.split('/')[1] || 'png';
    const filename = `input_${Date.now()}.${ext}`;
    
    // 1. 画像のアップロード
    const uploadedFileName = await uploadImage(imageBuffer, filename);
    
    // 2. ワークフローの書き換え
    const workflowPath = path.join(__dirname, '../../../aiservice/image/comfy_workflows/remove_background_workflow.json');
    if (!fs.existsSync(workflowPath)) {
        throw new Error(`Workflow template not found at ${workflowPath}`);
    }
    
    const workflowJson = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
    if (workflowJson['1'] && workflowJson['1'].inputs) {
        workflowJson['1'].inputs.image = uploadedFileName;
    } else {
        throw new Error('Invalid workflow template format: missing node 1');
    }
    
    // 3. ワークフローの実行
    return await runWorkflow(workflowJson);
}

// 外部に公開するメインサービス関数
export async function removeBackground(imageBuffer: Buffer, mimeType: string, engine: string): Promise<Buffer> {
    if (engine === 'comfy') {
        return await removeBackgroundWithComfyUI(imageBuffer, mimeType);
    } else if (engine === 'toonout') {
        // BiRefNet-ToonOut (GGUF + vision.cpp) — アニメ画像向け、torch非依存ローカル実行
        return await removeBackgroundToonOut(imageBuffer);
    } else {
        // デフォルトは Node.js 内の @imgly/background-removal-node
        const inputBlob = new Blob([imageBuffer], { type: mimeType });
        const resultBlob = await imglyRemoveBackground(inputBlob);
        return Buffer.from(await resultBlob.arrayBuffer());
    }
}
