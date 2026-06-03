import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// アプリケーション全体の共通設定インターフェース
export interface AppConfig {
    googleAiStudioApiKey: string;
    openaiApiKey: string;
    anthropicApiKey: string;
    selectedEngine: string;
    selectedVoiceEngine: string;
    selectedImageEngine: string;
    selectedVideoEngine: string;
    lmstudioEndpoint: string;
    lmstudioModel: string;
    geminiModel: string;
    openaiModel: string;
    anthropicModel: string;
    voicevoxEndpoint: string;
    voicevoxSpeaker: number;
    temperature: number;
    
    // チャットウィンドウ設定
    chatOpacity: number;
    chatAlwaysOnTop: boolean | 'sync';
    chatSendKey: string;
    chatFontFamily: string;
    
    // マスコット設定
    mascotScale: number;
    alwaysOnTop: boolean;
    
    // サーバー接続設定
    useServer: boolean;
    serverHost: string;
    serverPort: number;
    
    // マスコットデータ
    mascots: any[];
    activeMascotId: string;
}

export const useConfigStore = defineStore('config', () => {
    // ---- State ----
    const isLoaded = ref(false);

    const googleAiStudioApiKey = ref('');
    const openaiApiKey = ref('');
    const anthropicApiKey = ref('');
    
    const selectedEngine = ref('gemini');
    const selectedVoiceEngine = ref('voicevox');
    const selectedImageEngine = ref('dalle3');
    const selectedVideoEngine = ref('runway');
    
    const lmstudioEndpoint = ref('http://127.0.0.1:1234/v1/');
    const lmstudioModel = ref('');
    const geminiModel = ref('gemini-2.0-flash-exp');
    const openaiModel = ref('gpt-4o');
    const anthropicModel = ref('claude-3-5-sonnet-latest');
    
    const voicevoxEndpoint = ref('http://localhost:50021');
    const voicevoxSpeaker = ref(2); // デフォルト話者ID: 2 (四国めたんノーマル)
    const temperature = ref(0.7);

    // チャットウィンドウ設定
    const chatOpacity = ref(1.0);
    const chatAlwaysOnTop = ref<boolean | 'sync'>(true);
    const chatSendKey = ref('enter');
    const chatFontFamily = ref('sans-serif');
    
    // マスコット設定
    const mascotScale = ref(1.0);
    const alwaysOnTop = ref(true);

    // サーバー接続設定
    const useServer = ref(false);
    const serverHost = ref('localhost');
    const serverPort = ref(3000);

    // マスコット一覧とアクティブなマスコットID
    const mascots = ref<any[]>([]);
    const activeMascotId = ref('');
    const configVersion = ref(0);

    // ---- Getters ----
    // アクティブなマスコットのデータを返す定義
    const activeMascot = computed(() => {
        return mascots.value.find(m => m.id === activeMascotId.value) || mascots.value[0] || null;
    });

    // ---- Actions ----
    // メインプロセスまたは localStorage から設定データをロードする
    const loadConfig = async () => {
        let configData: any = null;

        if (window.electronAPI) {
            configData = await window.electronAPI.getAppConfig();
        }

        if (configData) {
            // メインプロセスから読み込んだデータをストアの State に代入
            googleAiStudioApiKey.value = configData.googleAiStudioApiKey || '';
            openaiApiKey.value = configData.openaiApiKey || '';
            anthropicApiKey.value = configData.anthropicApiKey || '';
            
            selectedEngine.value = configData.selectedEngine || 'gemini';
            selectedVoiceEngine.value = configData.selectedVoiceEngine || 'voicevox';
            selectedImageEngine.value = configData.selectedImageEngine || 'dalle3';
            selectedVideoEngine.value = configData.selectedVideoEngine || 'runway';
            
            lmstudioEndpoint.value = configData.lmstudioEndpoint || 'http://127.0.0.1:1234/v1/';
            lmstudioModel.value = configData.lmstudioModel || '';
            geminiModel.value = configData.geminiModel || 'gemini-2.0-flash-exp';
            openaiModel.value = configData.openaiModel || 'gpt-4o';
            anthropicModel.value = configData.anthropicModel || 'claude-3-5-sonnet-latest';
            
            voicevoxEndpoint.value = configData.voicevoxEndpoint || 'http://localhost:50021';
            voicevoxSpeaker.value = configData.voicevoxSpeaker !== undefined ? Number(configData.voicevoxSpeaker) : 2;
            temperature.value = configData.temperature !== undefined ? Number(configData.temperature) : 0.7;
            
            chatOpacity.value = configData.chatOpacity !== undefined ? Number(configData.chatOpacity) : 1.0;
            
            if (configData.chatAlwaysOnTop === 'sync') {
                chatAlwaysOnTop.value = 'sync';
            } else {
                chatAlwaysOnTop.value = configData.chatAlwaysOnTop !== undefined ? !!configData.chatAlwaysOnTop : true;
            }
            
            chatSendKey.value = configData.chatSendKey || 'enter';
            chatFontFamily.value = configData.chatFontFamily || 'sans-serif';
            
            mascotScale.value = configData.mascotScale !== undefined ? Number(configData.mascotScale) : 1.0;
            alwaysOnTop.value = configData.alwaysOnTop !== undefined ? !!configData.alwaysOnTop : true;
            
            useServer.value = configData.useServer !== undefined ? !!configData.useServer : false;
            serverHost.value = configData.serverHost || 'localhost';
            serverPort.value = configData.serverPort !== undefined ? Number(configData.serverPort) : 3000;
            
            mascots.value = configData.mascots || [];
            activeMascotId.value = configData.activeMascotId || '';
        } else {
            // Webブラウザ実行時の localStorage フォールバック
            googleAiStudioApiKey.value = localStorage.getItem('GoogleAiStudioApiKey') || '';
            openaiApiKey.value = localStorage.getItem('openaiApiKey') || '';
            anthropicApiKey.value = localStorage.getItem('anthropicApiKey') || '';
            
            selectedEngine.value = localStorage.getItem('selectedEngine') || 'gemini';
            selectedVoiceEngine.value = localStorage.getItem('selectedVoiceEngine') || 'voicevox';
            selectedImageEngine.value = localStorage.getItem('selectedImageEngine') || 'dalle3';
            selectedVideoEngine.value = localStorage.getItem('selectedVideoEngine') || 'runway';
            
            lmstudioEndpoint.value = localStorage.getItem('lmstudioEndpoint') || 'http://127.0.0.1:1234/v1/';
            lmstudioModel.value = localStorage.getItem('lmstudioModel') || '';
            geminiModel.value = localStorage.getItem('geminiModel') || 'gemini-2.0-flash-exp';
            openaiModel.value = localStorage.getItem('openaiModel') || 'gpt-4o';
            anthropicModel.value = localStorage.getItem('anthropicModel') || 'claude-3-5-sonnet-latest';
            
            voicevoxEndpoint.value = localStorage.getItem('voicevoxEndpoint') || 'http://localhost:50021';
            const savedSpeaker = localStorage.getItem('voicevoxSpeaker');
            voicevoxSpeaker.value = savedSpeaker ? parseInt(savedSpeaker) : 2;
            
            const temp = localStorage.getItem('temperature');
            temperature.value = temp ? parseFloat(temp) : 0.7;
            
            const opacity = localStorage.getItem('chatOpacity');
            chatOpacity.value = opacity ? parseFloat(opacity) : 1.0;
            
            const savedChatAlwaysOnTop = localStorage.getItem('chatAlwaysOnTop');
            if (savedChatAlwaysOnTop === 'sync') {
                chatAlwaysOnTop.value = 'sync';
            } else {
                chatAlwaysOnTop.value = savedChatAlwaysOnTop !== 'false';
            }
            
            chatSendKey.value = localStorage.getItem('chatSendKey') || 'enter';
            chatFontFamily.value = localStorage.getItem('chatFontFamily') || 'sans-serif';

            const scale = localStorage.getItem('mascotScale');
            mascotScale.value = scale ? parseFloat(scale) : 1.0;
            alwaysOnTop.value = localStorage.getItem('alwaysOnTop') !== 'false';
            
            useServer.value = localStorage.getItem('useServer') === 'true';
            serverHost.value = localStorage.getItem('serverHost') || 'localhost';
            const savedServerPort = localStorage.getItem('serverPort');
            serverPort.value = savedServerPort ? parseInt(savedServerPort) : 3000;

            const localMascots = localStorage.getItem('mascots');
            mascots.value = localMascots ? JSON.parse(localMascots) : [];
            activeMascotId.value = localStorage.getItem('activeMascotId') || '';
        }

        // 外部サーバー連携が有効な場合、サーバーから最新の設定を取得してストアを同期
        if (useServer.value) {
            try {
                const serverUrl = `http://${serverHost.value}:${serverPort.value}/api/config`;
                console.log(`[Config] Fetching latest config from server: ${serverUrl}`);
                const response = await fetch(serverUrl);
                if (response.ok) {
                    const resJson = await response.json();
                    if (resJson.success && resJson.config && Object.keys(resJson.config).length > 0) {
                        console.log('[Config] Config successfully loaded from server');
                        // サーバーの設定でストアを上書き
                        updateConfig(resJson.config);
                    }
                }
            } catch (e: any) {
                console.warn('[Config] Failed to fetch config from server, using local fallback:', e.message);
            }
        }
        
        isLoaded.value = true;
    };

    // 現在のストアの状態を設定ファイルおよび localStorage に保存する
    const saveConfig = async () => {
        const payload: AppConfig = {
            googleAiStudioApiKey: googleAiStudioApiKey.value,
            openaiApiKey: openaiApiKey.value,
            anthropicApiKey: anthropicApiKey.value,
            selectedEngine: selectedEngine.value,
            selectedVoiceEngine: selectedVoiceEngine.value,
            selectedImageEngine: selectedImageEngine.value,
            selectedVideoEngine: selectedVideoEngine.value,
            lmstudioEndpoint: lmstudioEndpoint.value,
            lmstudioModel: lmstudioModel.value,
            geminiModel: geminiModel.value,
            openaiModel: openaiModel.value,
            anthropicModel: anthropicModel.value,
            voicevoxEndpoint: voicevoxEndpoint.value,
            voicevoxSpeaker: Number(voicevoxSpeaker.value),
            temperature: Number(temperature.value),
            chatOpacity: Number(chatOpacity.value),
            chatAlwaysOnTop: chatAlwaysOnTop.value,
            chatSendKey: chatSendKey.value,
            chatFontFamily: chatFontFamily.value,
            mascotScale: Number(mascotScale.value),
            alwaysOnTop: alwaysOnTop.value,
            useServer: useServer.value,
            serverHost: serverHost.value,
            serverPort: Number(serverPort.value),
            mascots: JSON.parse(JSON.stringify(mascots.value)),
            activeMascotId: activeMascotId.value
        };

        // 外部サーバー連携が有効な場合、サーバー側にも設定データを送信して一元保存
        let savedPayload = payload;
        if (useServer.value) {
            try {
                const serverUrl = `http://${serverHost.value}:${serverPort.value}/api/config`;
                console.log(`[Config] Saving config to server: ${serverUrl}`);
                const response = await fetch(serverUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                if (response.ok) {
                    const resJson = await response.json();
                    if (resJson.success && resJson.config) {
                        console.log('[Config] Config successfully updated with server resolved static URLs');
                        // サーバーで画像パスが置換された最新の設定にストアを同期
                        updateConfig(resJson.config);
                        savedPayload = resJson.config;
                    }
                }
            } catch (e: any) {
                console.warn('[Config] Failed to save config to server:', e.message);
            }
        }

        if (window.electronAPI) {
            await window.electronAPI.updateAppConfig(savedPayload);
        }

        // localStorage へのバックアップ書き込み
        localStorage.setItem('GoogleAiStudioApiKey', googleAiStudioApiKey.value);
        localStorage.setItem('openaiApiKey', openaiApiKey.value);
        localStorage.setItem('anthropicApiKey', anthropicApiKey.value);
        localStorage.setItem('selectedEngine', selectedEngine.value);
        localStorage.setItem('selectedVoiceEngine', selectedVoiceEngine.value);
        localStorage.setItem('selectedImageEngine', selectedImageEngine.value);
        localStorage.setItem('selectedVideoEngine', selectedVideoEngine.value);
        localStorage.setItem('lmstudioEndpoint', lmstudioEndpoint.value);
        localStorage.setItem('lmstudioModel', lmstudioModel.value);
        localStorage.setItem('geminiModel', geminiModel.value);
        localStorage.setItem('openaiModel', openaiModel.value);
        localStorage.setItem('anthropicModel', anthropicModel.value);
        localStorage.setItem('voicevoxEndpoint', voicevoxEndpoint.value);
        localStorage.setItem('voicevoxSpeaker', voicevoxSpeaker.value.toString());
        localStorage.setItem('temperature', temperature.value.toString());
        localStorage.setItem('chatOpacity', chatOpacity.value.toString());
        localStorage.setItem('chatAlwaysOnTop', chatAlwaysOnTop.value.toString());
        localStorage.setItem('chatSendKey', chatSendKey.value);
        localStorage.setItem('chatFontFamily', chatFontFamily.value);
        localStorage.setItem('mascotScale', mascotScale.value.toString());
        localStorage.setItem('alwaysOnTop', alwaysOnTop.value.toString());
        localStorage.setItem('useServer', useServer.value.toString());
        localStorage.setItem('serverHost', serverHost.value);
        localStorage.setItem('serverPort', serverPort.value.toString());
        localStorage.setItem('mascots', JSON.stringify(mascots.value));
        localStorage.setItem('activeMascotId', activeMascotId.value);
    };

    // 一部の設定を一括で更新する
    const updateConfig = (newConfig: Partial<AppConfig>) => {
        if (newConfig.googleAiStudioApiKey !== undefined) googleAiStudioApiKey.value = newConfig.googleAiStudioApiKey;
        if (newConfig.openaiApiKey !== undefined) openaiApiKey.value = newConfig.openaiApiKey;
        if (newConfig.anthropicApiKey !== undefined) anthropicApiKey.value = newConfig.anthropicApiKey;
        if (newConfig.selectedEngine !== undefined) selectedEngine.value = newConfig.selectedEngine;
        if (newConfig.selectedVoiceEngine !== undefined) selectedVoiceEngine.value = newConfig.selectedVoiceEngine;
        if (newConfig.selectedImageEngine !== undefined) selectedImageEngine.value = newConfig.selectedImageEngine;
        if (newConfig.selectedVideoEngine !== undefined) selectedVideoEngine.value = newConfig.selectedVideoEngine;
        if (newConfig.lmstudioEndpoint !== undefined) lmstudioEndpoint.value = newConfig.lmstudioEndpoint;
        if (newConfig.lmstudioModel !== undefined) lmstudioModel.value = newConfig.lmstudioModel;
        if (newConfig.geminiModel !== undefined) geminiModel.value = newConfig.geminiModel;
        if (newConfig.openaiModel !== undefined) openaiModel.value = newConfig.openaiModel;
        if (newConfig.anthropicModel !== undefined) anthropicModel.value = newConfig.anthropicModel;
        if (newConfig.voicevoxEndpoint !== undefined) voicevoxEndpoint.value = newConfig.voicevoxEndpoint;
        if (newConfig.voicevoxSpeaker !== undefined) voicevoxSpeaker.value = Number(newConfig.voicevoxSpeaker);
        if (newConfig.temperature !== undefined) temperature.value = Number(newConfig.temperature);
        
        if (newConfig.chatOpacity !== undefined) chatOpacity.value = Number(newConfig.chatOpacity);
        if (newConfig.chatAlwaysOnTop !== undefined) chatAlwaysOnTop.value = newConfig.chatAlwaysOnTop;
        if (newConfig.chatSendKey !== undefined) chatSendKey.value = newConfig.chatSendKey;
        if (newConfig.chatFontFamily !== undefined) chatFontFamily.value = newConfig.chatFontFamily;
        if (newConfig.mascotScale !== undefined) mascotScale.value = Number(newConfig.mascotScale);
        if (newConfig.alwaysOnTop !== undefined) alwaysOnTop.value = !!newConfig.alwaysOnTop;
        if (newConfig.useServer !== undefined) useServer.value = !!newConfig.useServer;
        if (newConfig.serverHost !== undefined) serverHost.value = newConfig.serverHost;
        if (newConfig.serverPort !== undefined) serverPort.value = Number(newConfig.serverPort);
        
        if (newConfig.mascots !== undefined) mascots.value = newConfig.mascots;
        if (newConfig.activeMascotId !== undefined) activeMascotId.value = newConfig.activeMascotId;
        
        configVersion.value++;
    };

    return {
        isLoaded,
        googleAiStudioApiKey,
        openaiApiKey,
        anthropicApiKey,
        selectedEngine,
        selectedVoiceEngine,
        selectedImageEngine,
        selectedVideoEngine,
        lmstudioEndpoint,
        lmstudioModel,
        geminiModel,
        openaiModel,
        anthropicModel,
        voicevoxEndpoint,
        voicevoxSpeaker,
        temperature,
        chatOpacity,
        chatAlwaysOnTop,
        chatSendKey,
        chatFontFamily,
        mascotScale,
        alwaysOnTop,
        useServer,
        serverHost,
        serverPort,
        mascots,
        activeMascotId,
        activeMascot,
        configVersion,
        loadConfig,
        saveConfig,
        updateConfig
    };
});
