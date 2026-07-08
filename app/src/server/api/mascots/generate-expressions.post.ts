import { defineEventHandler, readBody, createError } from 'h3';
import fs from 'node:fs';
import path from 'node:path';
import { AiExpressionService } from '../../../skills/expression-service/expression-service';
import { USERS_DIR, resolveMascotPath } from '../../utils/paths';

// アダプターのセットアップ（まだ設定されていなければ行う）
AiExpressionService.setAdapter({
    readFileSync: (p: string) => fs.readFileSync(p) as any,
    existsSync: (p: string) => fs.existsSync(p),
    pathJoin: (...args: string[]) => path.join(...args),
    pathExtname: (p: string) => path.extname(p),
    resolveMascotPath: (p: string) => resolveMascotPath(p),
    cwd: () => {
        const currentCwd = process.cwd();
        const base = path.basename(currentCwd);
        if (base === 'ui' || base === 'app') {
            return path.dirname(currentCwd);
        }
        return currentCwd;
    }
});

function getUserConfigPath(userId: string): string {
    return path.join(USERS_DIR, userId, 'user_config.json');
}

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        const { base64Image, apiKey, emotions, userPromptTemplate, engine, model, history } = body;

        let userId = 'usr_local_dev_bypass';
        if (event.context.user) {
            userId = event.context.user.id;
        }

        let openaiApiKey = '';
        const configPath = getUserConfigPath(userId);
        if (fs.existsSync(configPath)) {
            try {
                const configJson = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                openaiApiKey = configJson.openaiApiKey || '';
            } catch (e: any) {
                console.error('[Server] Failed to read openaiApiKey from config:', e.message);
            }
        }

        const result = await AiExpressionService.generateExpressions(
            base64Image,
            apiKey,
            emotions,
            userPromptTemplate,
            engine,
            model,
            history,
            openaiApiKey
        );

        return result;
    } catch (error: any) {
        console.error('[Server] generate-expressions failed:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
