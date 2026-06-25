import { ipcMain, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { AppConfig, ConfigData } from '../app-config';
import { getChatWindow, getEffectiveChatAlwaysOnTop } from '../window/chat-window';
import { getMascotWindow } from '../window/mascot-window';
import { getSettingsWindow } from '../window/settings-window';
import { getIntegratedWindow } from '../window/integrated-window';
import { getCompactWindow } from '../window/compact-window';

/**
 * プロジェクトの prompts/radio ディレクトリの絶対パスを探索して取得する
 */
function resolveRadioDir(): string {
    const currentCwd = process.cwd();
    const appPath = app.getAppPath();
    
    const candidates = [
        path.join(currentCwd, 'prompts', 'radio'),
        path.join(currentCwd, '..', 'prompts', 'radio'),
        path.join(appPath, 'prompts', 'radio'),
        path.join(appPath, '..', 'prompts', 'radio'),
        path.join(appPath, '..', '..', 'prompts', 'radio')
    ];

    for (const dir of candidates) {
        if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'radio_mode_instructions.md'))) {
            return dir;
        }
    }
    
    // 見つからない場合のデフォルトフォールバック
    const fallbackBase = path.basename(currentCwd) === 'ui' ? path.dirname(currentCwd) : currentCwd;
    return path.join(fallbackBase, 'prompts', 'radio');
}

/**
 * Config 関連の IPC ハンドラーを登録する
 */
export function registerConfigHandlers(config: AppConfig) {
    // 9. 設定の取得および更新ハンドラー
    ipcMain.handle('get-app-config', async () => {
        return config.get();
    });

    ipcMain.handle('update-app-config', async (event, newData: Partial<ConfigData>) => {
        const previousConfig = { ...config.get() };
        config.update(newData);
        console.log('[Config] Configuration updated via IPC');

        const currentConfig = config.get();

        // 1. チャットウィンドウへの伝達と最前面制御 (連動判定を考慮)
        const chatWin = getChatWindow();
        if (chatWin && !chatWin.isDestroyed()) {
            const prevEffectiveAlwaysOnTop = getEffectiveChatAlwaysOnTop(previousConfig);
            const nextEffectiveAlwaysOnTop = getEffectiveChatAlwaysOnTop(currentConfig);
            
            // 実際に最前面状態が変化した場合のみ setAlwaysOnTop を実行する
            if (prevEffectiveAlwaysOnTop !== nextEffectiveAlwaysOnTop) {
                console.log(`[Config] Chat window AlwaysOnTop changed: ${prevEffectiveAlwaysOnTop} -> ${nextEffectiveAlwaysOnTop}`);
                if (nextEffectiveAlwaysOnTop) {
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
            const prevAlwaysOnTop = !!previousConfig.alwaysOnTop;
            const nextAlwaysOnTop = !!currentConfig.alwaysOnTop;

            // 実際に最前面状態が変化した場合のみ実行する
            if (prevAlwaysOnTop !== nextAlwaysOnTop) {
                console.log(`[Config] Mascot window AlwaysOnTop changed: ${prevAlwaysOnTop} -> ${nextAlwaysOnTop}`);
                if (nextAlwaysOnTop) {
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
            const prevAlwaysOnTop = !!previousConfig.alwaysOnTop;
            const nextAlwaysOnTop = !!currentConfig.alwaysOnTop;

            if (prevAlwaysOnTop !== nextAlwaysOnTop) {
                if (nextAlwaysOnTop) {
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
            const prevAlwaysOnTop = !!previousConfig.alwaysOnTop;
            const nextAlwaysOnTop = !!currentConfig.alwaysOnTop;

            if (prevAlwaysOnTop !== nextAlwaysOnTop) {
                if (nextAlwaysOnTop) {
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

    // 画像データを mascots/<mascotId> に保存するハンドラー
    ipcMain.handle('save-mascot-image', async (event, mascotId: string, filename: string, base64Data: string) => {
        const currentCwd = process.cwd();
        const baseCwd = path.basename(currentCwd) === 'ui' ? path.dirname(currentCwd) : currentCwd;
        const mascotDir = path.join(baseCwd, 'mascots', mascotId);

        try {
            if (!fs.existsSync(mascotDir)) {
                fs.mkdirSync(mascotDir, { recursive: true });
            }

            // data:image/png;base64,... のようなヘッダーがあれば除去
            const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Content, 'base64');

            const filePath = path.join(mascotDir, filename);
            const fileDir = path.dirname(filePath);
            if (!fs.existsSync(fileDir)) {
                fs.mkdirSync(fileDir, { recursive: true });
            }

            fs.writeFileSync(filePath, buffer);

            console.log(`[Config] Mascot image saved: ${filePath}`);
            
            // UIからアクセス可能な相対アセットパスを返す
            return {
                success: true,
                path: `/mascots/${mascotId}/${filename}`
            };
        } catch (error: any) {
            console.error('[Config] Failed to save mascot image:', error);
            return { success: false, error: error.message };
        }
    });

    // ラジオモード用のプロンプト（通常・能動フリートーク・Ex）の読み込みハンドラー
    ipcMain.handle('get-radio-prompts', async () => {
        const radioDir = resolveRadioDir();
        console.log(`[Config] Reading radio prompts from: ${radioDir} (cwd: ${process.cwd()})`);

        const result = {
            radioMode: '',
            activeTalk: '',
            exRadioMode: '',
            exActiveTalk: ''
        };

        try {
            if (fs.existsSync(radioDir)) {
                const radioModePath = path.join(radioDir, 'radio_mode_instructions.md');
                const activeTalkPath = path.join(radioDir, 'active_radio_talk_instructions.md');
                const exRadioModePath = path.join(radioDir, 'ex_radio_mode_instructions.md');
                const exActiveTalkPath = path.join(radioDir, 'ex_active_radio_talk_instructions.md');

                if (fs.existsSync(radioModePath)) {
                    result.radioMode = fs.readFileSync(radioModePath, 'utf8');
                    console.log(`[Config] Successfully loaded radio_mode_instructions.md (${result.radioMode.length} chars)`);
                }
                if (fs.existsSync(activeTalkPath)) {
                    result.activeTalk = fs.readFileSync(activeTalkPath, 'utf8');
                    console.log(`[Config] Successfully loaded active_radio_talk_instructions.md (${result.activeTalk.length} chars)`);
                }
                if (fs.existsSync(exRadioModePath)) {
                    result.exRadioMode = fs.readFileSync(exRadioModePath, 'utf8');
                    console.log(`[Config] Successfully loaded ex_radio_mode_instructions.md (${result.exRadioMode.length} chars)`);
                }
                if (fs.existsSync(exActiveTalkPath)) {
                    result.exActiveTalk = fs.readFileSync(exActiveTalkPath, 'utf8');
                    console.log(`[Config] Successfully loaded ex_active_radio_talk_instructions.md (${result.exActiveTalk.length} chars)`);
                }
            } else {
                console.warn(`[Config] Radio directory not found: ${radioDir}`);
            }
        } catch (e: any) {
            console.error('[Config] Error reading radio prompts:', e);
        }
        return result;
    });

    // ラジオモード用のプロンプト（通常・能動フリートーク・Ex）の保存ハンドラー
    ipcMain.handle('save-radio-prompts', async (event, prompts: { radioMode: string; activeTalk: string; exRadioMode?: string; exActiveTalk?: string }) => {
        const radioDir = resolveRadioDir();

        try {
            if (!fs.existsSync(radioDir)) {
                fs.mkdirSync(radioDir, { recursive: true });
            }
            fs.writeFileSync(path.join(radioDir, 'radio_mode_instructions.md'), prompts.radioMode || '', 'utf8');
            fs.writeFileSync(path.join(radioDir, 'active_radio_talk_instructions.md'), prompts.activeTalk || '', 'utf8');
            if (prompts.exRadioMode !== undefined) {
                fs.writeFileSync(path.join(radioDir, 'ex_radio_mode_instructions.md'), prompts.exRadioMode || '', 'utf8');
            }
            if (prompts.exActiveTalk !== undefined) {
                fs.writeFileSync(path.join(radioDir, 'ex_active_radio_talk_instructions.md'), prompts.exActiveTalk || '', 'utf8');
            }
            console.log(`[Config] Radio prompts saved successfully to: ${radioDir}`);
            return { success: true };
        } catch (error: any) {
            console.error('[Config] Failed to save radio prompts:', error);
            return { success: false, error: error.message };
        }
    });
}
