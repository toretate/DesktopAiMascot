// Browser Polyfill for Electron IPC
// window.electronAPI が存在しない（Webブラウザ環境）の場合に、API呼び出しをエミュレートする

import { defaultData } from '../config/config-data';
import { IrodoriTtsConnector } from '../connector/irodori-tts-connector';

if (typeof window !== 'undefined' && !window.electronAPI) {
    console.log('[Polyfill] Running in Web Browser. Initializing browser-polyfill...');

    // イベントリスナーのコールバック保持用
    const callbacks = {
        applyPreviewState: [] as ((state: any) => void)[],
        emotionChanged: [] as ((emotion: string) => void)[],
        chatToggled: [] as ((visible: boolean) => void)[],
        configUpdated: [] as ((config: any) => void)[],
        timerTrigger: [] as ((memo: string) => void)[]
    };

    // ヘルパー: 設定データを localStorage から読み込み / 保存
    const getStoredConfig = () => {
        try {
            const configStr = localStorage.getItem('desktop_ai_mascot_config');
            if (configStr) {
                return { ...defaultData, ...JSON.parse(configStr) };
            }
        } catch (e) {
            console.error('[Polyfill] Failed to load config from localStorage:', e);
        }
        return defaultData;
    };

    const saveStoredConfig = (config: any) => {
        try {
            localStorage.setItem('desktop_ai_mascot_config', JSON.stringify(config));
            // 変更通知
            callbacks.configUpdated.forEach(cb => cb(config));
        } catch (e) {
            console.error('[Polyfill] Failed to save config to localStorage:', e);
        }
    };

    window.electronAPI = {
        isWeb: true,
        loginWithGoogle: () => {
            alert('GoogleログインはWeb版では現在サポートされていません。設定画面で直接APIキーをご登録ください。');
        },
        toggleChat: () => {
            console.log('[Polyfill] toggleChat triggered');
        },
        resizeChatWindow: (size: { width: number; height: number }) => {
            console.log(`[Polyfill] resizeChatWindow: ${size.width}x${size.height}`);
        },
        openSettings: () => {
            // Web版では、ハッシュを #settings に切り替えることで設定画面を表示する
            window.location.hash = '#settings';
        },
        setMascotScale: (scale: number) => {
            console.log(`[Polyfill] setMascotScale: ${scale}`);
            const config = getStoredConfig();
            config.mascotScale = scale;
            saveStoredConfig(config);
        },
        setIgnoreMouseEvents: (ignore: boolean) => {
            // ブラウザでは何もしない
        },
        dragWindow: (offset: { dx: number; dy: number; isStart?: boolean; isEnd?: boolean }) => {
            // ブラウザでは何もしない
        },
        updateCharacterBounds: (bounds: { top: number; bottom: number; left: number; right: number }) => {
            // ブラウザでは何もしない
        },
        quitApp: () => {
            if (confirm('アプリを終了しますか？（ブラウザタブを閉じます）')) {
                window.close();
            }
        },
        relaunchApp: () => {
            // ページのリロードがアプリ再起動の代わりとなる
            window.location.reload();
        },
        getAppConfig: async () => {
            try {
                const response = await fetch('http://localhost:3000/api/config');
                if (response.ok) {
                    const resJson = await response.json();
                    if (resJson.success && resJson.config && Object.keys(resJson.config).length > 0) {
                        console.log('[Polyfill] Config successfully loaded from server');
                        // ローカルのlocalStorageにも同期保存しておく
                        saveStoredConfig(resJson.config);
                        return resJson.config;
                    }
                }
            } catch (e) {
                console.warn('[Polyfill] Failed to fetch config from server, using local fallback:', e);
            }
            return getStoredConfig();
        },
        updateAppConfig: async (config: any) => {
            try {
                const response = await fetch('http://localhost:3000/api/config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(config)
                });
                if (response.ok) {
                    console.log('[Polyfill] Config successfully saved to server');
                }
            } catch (e) {
                console.warn('[Polyfill] Failed to save config to server, using local fallback:', e);
            }
            saveStoredConfig(config);
        },
        testServerConnection: async (host: string, port: number) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            try {
                const response = await fetch(`http://${host}:${port}/api/config`, {
                    method: 'GET',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                return { success: response.ok, message: response.ok ? '接続成功' : `HTTP Error: ${response.status}` };
            } catch (e: any) {
                clearTimeout(timeoutId);
                return { success: false, error: e.message || '接続に失敗しました' };
            }
        },
        askGemini: async (message: string, apiKey: string, systemPrompt: string, modelName: string, history?: any[], attachments?: any[]) => {
            const model = modelName || 'gemini-3.1-flash-lite';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒タイムアウト

            try {
                // 履歴マッピング
                const contents = (history || []).map((msg: any) => ({
                    role: msg.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text }]
                }));

                const parts: any[] = [{ text: message || '' }];
                if (attachments && attachments.length > 0) {
                    for (const att of attachments) {
                        if (att.type === 'image' && att.url.startsWith('data:')) {
                            const match = att.url.match(/^data:(image\/\w+);base64,(.+)$/);
                            if (match) {
                                parts.push({
                                    inlineData: {
                                        mimeType: match[1],
                                        data: match[2]
                                    }
                                });
                            }
                        }
                    }
                }

                contents.push({
                    role: 'user',
                    parts: parts
                });

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: contents,
                        systemInstruction: {
                            parts: [{ text: systemPrompt || 'You are a helpful assistant.' }]
                        }
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API Error: ${response.status} ${errorText}`);
                }

                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                return text || 'Error: 空の返答を受信しました。';
            } catch (e: any) {
                clearTimeout(timeoutId);
                console.error('[Polyfill] Gemini API Error:', e.message);
                throw e;
            }
        },
        askLmStudio: async (message: string, systemPrompt: string, modelName: string, endpoint: string, history?: any[], attachments?: any[]) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);
            try {
                const messages = [
                    { role: 'system', content: systemPrompt },
                    ...(history || []).map((msg: any) => ({
                        role: msg.sender === 'user' ? 'user' : 'assistant',
                        content: msg.text
                    })),
                    { role: 'user', content: message }
                ];

                const response = await fetch(`${endpoint}chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: modelName,
                        messages: messages,
                        temperature: 0.7
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`LM Studio Error: ${response.status} ${errorText}`);
                }

                const data = await response.json();
                const text = data.choices?.[0]?.message?.content;
                return text || 'Error: 空の返答を受信しました。';
            } catch (e: any) {
                clearTimeout(timeoutId);
                console.error('[Polyfill] LM Studio API Error:', e.message);
                throw e;
            }
        },
        getChatHistory: async () => {
            try {
                const response = await fetch('http://localhost:3000/api/history');
                if (response.ok) {
                    const resJson = await response.json();
                    if (resJson.success && resJson.history) {
                        console.log('[Polyfill] Chat history successfully loaded from server');
                        // 同期用にローカルのlocalStorageにも保存しておく
                        localStorage.setItem('desktop_ai_mascot_chat_history', JSON.stringify(resJson.history));
                        return resJson.history;
                    }
                }
            } catch (e) {
                console.warn('[Polyfill] Failed to fetch chat history from server, using local fallback:', e);
            }
            try {
                const historyStr = localStorage.getItem('desktop_ai_mascot_chat_history');
                return historyStr ? JSON.parse(historyStr) : {};
            } catch (e) {
                console.error('[Polyfill] Failed to load chat history from localStorage:', e);
                return {};
            }
        },
        saveChatHistory: async (history: any) => {
            try {
                const response = await fetch('http://localhost:3000/api/history', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(history)
                });
                if (response.ok) {
                    console.log('[Polyfill] Chat history successfully saved to server');
                }
            } catch (e) {
                console.warn('[Polyfill] Failed to save chat history to server, using local fallback:', e);
            }
            try {
                localStorage.setItem('desktop_ai_mascot_chat_history', JSON.stringify(history));
                return { success: true };
            } catch (e: any) {
                console.error('[Polyfill] Failed to save chat history to localStorage:', e);
                return { success: false, error: e.message };
            }
        },
        openChatHistory: () => {
            console.log('[Polyfill] openChatHistory triggered');
        },
        getMascotPrompts: async (mascotId: string) => {
            try {
                const promptStr = localStorage.getItem(`desktop_ai_mascot_prompts_${mascotId}`);
                if (promptStr) {
                    return JSON.parse(promptStr);
                }
            } catch (e) {
                console.error('[Polyfill] Failed to get mascot prompts:', e);
            }
            return { soul: '', identity: '', user: '', agents: '', memory: '' };
        },
        saveMascotPrompts: async (mascotId: string, prompts: any) => {
            try {
                localStorage.setItem(`desktop_ai_mascot_prompts_${mascotId}`, JSON.stringify(prompts));
                return { success: true };
            } catch (e: any) {
                console.error('[Polyfill] Failed to save mascot prompts:', e);
                return { success: false, error: e.message };
            }
        },
        getRadioPrompts: async () => {
            try {
                const radioMode = localStorage.getItem('desktop_ai_mascot_radio_mode_prompt') || '';
                const activeTalk = localStorage.getItem('desktop_ai_mascot_active_talk_prompt') || '';
                const exRadioMode = localStorage.getItem('desktop_ai_mascot_ex_radio_mode_prompt') || '';
                const exActiveTalk = localStorage.getItem('desktop_ai_mascot_ex_active_talk_prompt') || '';
                return { radioMode, activeTalk, exRadioMode, exActiveTalk };
            } catch (e) {
                console.error('[Polyfill] Failed to get radio prompts:', e);
                return { radioMode: '', activeTalk: '', exRadioMode: '', exActiveTalk: '' };
            }
        },
        saveRadioPrompts: async (prompts: any) => {
            try {
                localStorage.setItem('desktop_ai_mascot_radio_mode_prompt', prompts.radioMode || '');
                localStorage.setItem('desktop_ai_mascot_active_talk_prompt', prompts.activeTalk || '');
                localStorage.setItem('desktop_ai_mascot_ex_radio_mode_prompt', prompts.exRadioMode || '');
                localStorage.setItem('desktop_ai_mascot_ex_active_talk_prompt', prompts.exActiveTalk || '');
                return { success: true };
            } catch (e: any) {
                console.error('[Polyfill] Failed to save radio prompts:', e);
                return { success: false, error: e.message };
            }
        },
        getLmStudioModels: async (endpoint: string) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            try {
                const response = await fetch(`${endpoint}models`, {
                    method: 'GET',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                return { success: true, models: data.data || [] };
            } catch (e: any) {
                clearTimeout(timeoutId);
                return { success: false, models: [], error: e.message || '接続に失敗しました' };
            }
        },
        synthesizeVoicevox: async (text: string, speakerId: number, endpoint?: string) => {
            const baseEndpoint = endpoint || 'http://localhost:50021';
            try {
                // 1. 音声クエリの作成
                const queryRes = await fetch(`${baseEndpoint}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`, {
                    method: 'POST'
                });
                if (!queryRes.ok) throw new Error(`audio_query failed: ${queryRes.status}`);
                const queryJson = await queryRes.json();

                // 2. 音声合成
                const synthRes = await fetch(`${baseEndpoint}/synthesis?speaker=${speakerId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(queryJson)
                });
                if (!synthRes.ok) throw new Error(`synthesis failed: ${synthRes.status}`);

                // 3. バイナリデータを Base64 に変換
                const arrayBuffer = await synthRes.arrayBuffer();
                const base64 = btoa(
                    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
                );
                return base64;
            } catch (e) {
                console.error('[Polyfill] VOICEVOX synthesis failed:', e);
                return null;
            }
        },
        synthesizeIrodori: async (text: string, endpoint: string, model: string, voice: string, emotion?: string) => {
            return IrodoriTtsConnector.synthesize(
                {
                    input: text,
                    model: model,
                    voice: voice
                },
                emotion,
                endpoint
            );
        },
        getVoicevoxSpeakers: async (endpoint: string) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            try {
                const response = await fetch(`${endpoint}/speakers`, {
                    method: 'GET',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                const speakers = data.map((sp: any) => {
                    const style = sp.styles?.[0]?.id !== undefined ? sp.styles[0].id : 0;
                    return { name: `${sp.name} (${sp.styles?.[0]?.name || ''})`, value: style };
                });
                return { success: true, speakers };
            } catch (e: any) {
                clearTimeout(timeoutId);
                return { success: false, speakers: [], error: e.message || '接続に失敗しました' };
            }
        },
        getIrodoriVoices: async (endpoint: string) => {
            try {
                const result = await IrodoriTtsConnector.listVoices(endpoint);
                if (result && result.data) {
                    return { success: true, voices: result.data };
                }
                return { success: false, voices: [], error: 'ボイス一覧の取得に失敗しました。' };
            } catch (e: any) {
                return { success: false, voices: [], error: e.message || '接続に失敗しました' };
            }
        },
        generateMascotExpressions: async () => {
            return { success: false, error: 'AI表情自動生成機能はWeb版ではサポートされていません。' };
        },
        getImagenModels: async () => {
            return [];
        },
        getGeminiModels: async (apiKey: string) => {
            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
                const data = await response.json();
                const models = (data.models || [])
                    .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                    .map((m: any) => m.name.replace('models/', ''));
                return { success: true, models };
            } catch (e: any) {
                clearTimeout(timeoutId);
                return { success: false, models: [], error: e.message || '接続確認に失敗しました。' };
            }
        },
        analyzeSpriteSheet: async () => {
            return null;
        },
        selectLocalImage: async () => {
            // ブラウザの画像ファイル選択ダイアログを開き、Base64（DataURL）として返す
            return new Promise((resolve) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files;
                    if (files && files.length > 0) {
                        const file = files[0];
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            const dataUrl = event.target?.result as string;
                            resolve({
                                success: true,
                                path: dataUrl, // Web版ではDataURLを画像パスの代わりに返却する
                                name: file.name
                            });
                        };
                        reader.onerror = () => resolve(null);
                        reader.readAsDataURL(file);
                    } else {
                        resolve(null);
                    }
                };
                input.click();
            });
        },
        saveMascotImage: async (mascotId: string, filename: string, base64Data: string) => {
            console.log(`[Polyfill] saveMascotImage called for mascot: ${mascotId}, file: ${filename}`);
            return {
                success: true,
                path: base64Data
            };
        },
        previewMascotState: (previewState: any) => {
            callbacks.applyPreviewState.forEach(cb => cb(previewState));
        },
        onApplyPreviewState: (callback: (previewState: any) => void) => {
            callbacks.applyPreviewState.push(callback);
            return () => {
                callbacks.applyPreviewState = callbacks.applyPreviewState.filter(cb => cb !== callback);
            };
        },
        changeEmotion: (emotion: string) => {
            callbacks.emotionChanged.forEach(cb => cb(emotion));
        },
        onEmotionChanged: (callback: (emotion: string) => void) => {
            callbacks.emotionChanged.push(callback);
            return () => {
                callbacks.emotionChanged = callbacks.emotionChanged.filter(cb => cb !== callback);
            };
        },
        onChatToggled: (callback: (visible: boolean) => void) => {
            callbacks.chatToggled.push(callback);
            return () => {
                callbacks.chatToggled = callbacks.chatToggled.filter(cb => cb !== callback);
            };
        },
        onConfigUpdated: (callback: (config: any) => void) => {
            callbacks.configUpdated.push(callback);
            return () => {
                callbacks.configUpdated = callbacks.configUpdated.filter(cb => cb !== callback);
            };
        },
        startTimer: (seconds: number, memo: string) => {
            console.log(`[Polyfill] Timer started: ${seconds} seconds, memo: ${memo}`);
            setTimeout(() => {
                console.log(`[Polyfill] Timer triggered: ${memo}`);
                callbacks.timerTrigger.forEach(cb => cb(memo));
            }, seconds * 1000);
        },
        triggerTimerNotification: (memo: string) => {
            callbacks.timerTrigger.forEach(cb => cb(memo));
        },
        onTimerTrigger: (callback: (memo: string) => void) => {
            callbacks.timerTrigger.push(callback);
            return () => {
                callbacks.timerTrigger = callbacks.timerTrigger.filter(cb => cb !== callback);
            };
        }
    };
}
