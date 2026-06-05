import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { AppConfig, ConfigData } from '../app-config';
import { getChatWindow, getEffectiveChatAlwaysOnTop } from '../window/chat-window';
import { getMascotWindow } from '../window/mascot-window';
import { getSettingsWindow } from '../window/settings-window';
import { getIntegratedWindow } from '../window/integrated-window';
import { getCompactWindow } from '../window/compact-window';

/**
 * Config 関連の IPC ハンドラーを登録する
 */
export function registerConfigHandlers(config: AppConfig) {
    // 9. 設定の取得および更新ハンドラー
    ipcMain.handle('get-app-config', async () => {
        return config.get();
    });

    ipcMain.handle('update-app-config', async (event, newData: Partial<ConfigData>) => {
        config.update(newData);
        console.log('[Config] Configuration updated via IPC');

        const currentConfig = config.get();

        // 1. チャットウィンドウへの伝達と最前面制御 (連動判定を考慮)
        const chatWin = getChatWindow();
        if (chatWin && !chatWin.isDestroyed()) {
            if (newData.chatAlwaysOnTop !== undefined || newData.alwaysOnTop !== undefined) {
                const effectiveAlwaysOnTop = getEffectiveChatAlwaysOnTop(currentConfig);
                if (effectiveAlwaysOnTop) {
                    chatWin.setAlwaysOnTop(true, 'floating');
                } else {
                    chatWin.setAlwaysOnTop(false);
                }
            }
            chatWin.webContents.send('config-updated', currentConfig);
        }

        // 2. マスコットウィンドウへの伝達と最前面制御 (レベル 'screen-saver' を指定)
        const mascotWin = getMascotWindow();
        if (mascotWin && !mascotWin.isDestroyed()) {
            if (newData.alwaysOnTop !== undefined) {
                if (newData.alwaysOnTop) {
                    mascotWin.setAlwaysOnTop(true, 'screen-saver');
                } else {
                    mascotWin.setAlwaysOnTop(false);
                }
            }
            mascotWin.webContents.send('config-updated', currentConfig);
        }

        // 4. 統合ウィンドウへの伝達と最前面制御
        const integratedWin = getIntegratedWindow();
        if (integratedWin && !integratedWin.isDestroyed()) {
            if (newData.alwaysOnTop !== undefined) {
                if (newData.alwaysOnTop) {
                    integratedWin.setAlwaysOnTop(true, 'screen-saver');
                } else {
                    integratedWin.setAlwaysOnTop(false);
                }
            }
            integratedWin.webContents.send('config-updated', currentConfig);
        }

        // 5. コンパクトウィンドウへの伝達と最前面制御
        const compactWin = getCompactWindow();
        if (compactWin && !compactWin.isDestroyed()) {
            if (newData.alwaysOnTop !== undefined) {
                if (newData.alwaysOnTop) {
                    compactWin.setAlwaysOnTop(true, 'screen-saver');
                } else {
                    compactWin.setAlwaysOnTop(false);
                }
            }
            compactWin.webContents.send('config-updated', currentConfig);
        }

        // 3. 設定ウィンドウへの伝達
        const settingsWin = getSettingsWindow();
        if (settingsWin && !settingsWin.isDestroyed()) {
            settingsWin.webContents.send('config-updated', currentConfig);
        }
    });

    // マスコットの openclaw スタイルプロンプト（soul, identity, user, agents, memory）の読み込みハンドラー
    ipcMain.handle('get-mascot-prompts', async (event, mascotId: string) => {
        const currentCwd = process.cwd();
        const baseCwd = path.basename(currentCwd) === 'ui' ? path.dirname(currentCwd) : currentCwd;
        const mascotDir = path.join(baseCwd, 'mascots', mascotId);

        const result = {
            soul: '',
            identity: '',
            user: '',
            agents: '',
            memory: ''
        };

        if (fs.existsSync(mascotDir)) {
            const soulPath = path.join(mascotDir, 'soul.md');
            const identityPath = path.join(mascotDir, 'identity.md');
            const userPath = path.join(mascotDir, 'user.md');
            const agentsPath = path.join(mascotDir, 'agents.md');
            const memoryPath = path.join(mascotDir, 'memory.md');

            // テンプレート自動生成（初期化）
            if (!fs.existsSync(soulPath)) {
                const defaultSoul = `# Mascot Soul & Tone\n\n- 口調: 親しみやすく、少し甘えん坊なトーンで話す。\n- 感情表現: ユーザーに懐いており、[happy] な感情になりやすい。\n- 語尾: 「〜だよ」「〜だね」を好んで使う。\n`;
                fs.writeFileSync(soulPath, defaultSoul, 'utf8');
            }
            if (!fs.existsSync(identityPath)) {
                const defaultIdentity = `# Mascot Identity\n\n- 名前: AIマスコット\n- 役割: ユーザーのデスクトップに住み着いた電子の妖精。\n- 目的: ユーザーの作業を見守り、おしゃべり相手になること。\n`;
                fs.writeFileSync(identityPath, defaultIdentity, 'utf8');
            }
            if (!fs.existsSync(userPath)) {
                const defaultUser = `# User Context\n\n- ユーザーへの呼び方: 「マスター」\n- 関係性: 常にマスターを第一に考え、応援している。\n`;
                fs.writeFileSync(userPath, defaultUser, 'utf8');
            }
            if (!fs.existsSync(agentsPath)) {
                const defaultAgents = `# Mascot Agents & Rules\n\n- ルール: 不適切な表現や暴力的・攻撃的な発言は絶対に避けてください。\n- 安全基準: 常にマスターにとって安全で励みになる存在であり続けること。\n`;
                fs.writeFileSync(agentsPath, defaultAgents, 'utf8');
            }
            if (!fs.existsSync(memoryPath)) {
                const defaultMemory = `# Mascot Long-term Memory\n\n- 重要な決定事項: ここには会話を通じて学んだ情報や、重要な約束事を記録します。\n`;
                fs.writeFileSync(memoryPath, defaultMemory, 'utf8');
            }

            result.soul = fs.readFileSync(soulPath, 'utf8');
            result.identity = fs.readFileSync(identityPath, 'utf8');
            result.user = fs.readFileSync(userPath, 'utf8');
            result.agents = fs.readFileSync(agentsPath, 'utf8');
            result.memory = fs.readFileSync(memoryPath, 'utf8');
        }
        return result;
    });

    // マスコットの openclaw スタイルプロンプト（soul, identity, user, agents, memory）の保存ハンドラー
    ipcMain.handle('save-mascot-prompts', async (event, mascotId: string, prompts: { soul: string; identity: string; user: string; agents: string; memory: string }) => {
        const currentCwd = process.cwd();
        const baseCwd = path.basename(currentCwd) === 'ui' ? path.dirname(currentCwd) : currentCwd;
        const mascotDir = path.join(baseCwd, 'mascots', mascotId);

        try {
            if (!fs.existsSync(mascotDir)) {
                fs.mkdirSync(mascotDir, { recursive: true });
            }
            fs.writeFileSync(path.join(mascotDir, 'soul.md'), prompts.soul || '', 'utf8');
            fs.writeFileSync(path.join(mascotDir, 'identity.md'), prompts.identity || '', 'utf8');
            fs.writeFileSync(path.join(mascotDir, 'user.md'), prompts.user || '', 'utf8');
            fs.writeFileSync(path.join(mascotDir, 'agents.md'), prompts.agents || '', 'utf8');
            fs.writeFileSync(path.join(mascotDir, 'memory.md'), prompts.memory || '', 'utf8');
            console.log(`[Config] Mascot prompts saved for: ${mascotId}`);
            return { success: true };
        } catch (error: any) {
            console.error('[Config] Failed to save mascot prompts:', error);
            return { success: false, error: error.message };
        }
    });
}
