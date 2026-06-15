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
    irodoriEndpoint: string;
    irodoriModel: string;
    irodoriVoice: string;
    temperature: number;
    
    // チャットウィンドウ設定
    chatOpacity: number;
    chatAlwaysOnTop: boolean | 'sync';
    chatSendKey: string;
    chatFontFamily: string;
    chatBorderShow: boolean;
    chatBorderColor: string;
    chatBorderWidth: number;
    chatBackgroundColor: string;
    
    // マスコット設定
    mascotScale: number;
    alwaysOnTop: boolean;
    
    // サーバー接続設定
    useServer: boolean;
    serverHost: string;
    serverPort: number;

    // TTS設定
    useTts: boolean;
    
    // ウィンドウモード
    windowMode: 'split' | 'integrated' | 'compact';

    // マスコットデータ
    mascots: any[];
    activeMascotId: string;

    // ツール使用設定 (ToolUse)
    toolsCurrentTime: boolean;
    toolsGpsLocation: boolean;
    toolsWeather: boolean;
    toolsVolume: boolean;
    toolsAppLauncher: boolean;
    toolsWebSearch: boolean;
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
    const irodoriEndpoint = ref('http://127.0.0.1:8088');
    const irodoriModel = ref('irodori-tts');
    const irodoriVoice = ref('default');
    const temperature = ref(0.7);

    // チャットウィンドウ設定
    const chatOpacity = ref(1.0);
    const chatAlwaysOnTop = ref<boolean | 'sync'>(true);
    const chatSendKey = ref('enter');
    const chatFontFamily = ref('sans-serif');
    const chatBorderShow = ref(true);
    const chatBorderColor = ref('#a855f7');
    const chatBorderWidth = ref(1);
    const chatBackgroundColor = ref('#ffffff');
    
    // マスコット設定
    const mascotScale = ref(1.0);
    const alwaysOnTop = ref(true);

    // サーバー接続設定
    const useServer = ref(false);
    const serverHost = ref('localhost');
    const serverPort = ref(3000);

    // TTS設定
    const useTts = ref(true);

    // ウィンドウモード
    const windowMode = ref<'split' | 'integrated' | 'compact'>('split');

    // マスコット一覧とアクティブなマスコットID
    const mascots = ref<any[]>([]);
    const activeMascotId = ref('');

    // ツール使用設定 (ToolUse)
    const toolsCurrentTime = ref(true);
    const toolsGpsLocation = ref(true);
    const toolsWeather = ref(true);
    const toolsVolume = ref(true);
    const toolsAppLauncher = ref(true);
    const toolsWebSearch = ref(true);
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
            irodoriEndpoint.value = configData.irodoriEndpoint || 'http://127.0.0.1:8088';
            irodoriModel.value = configData.irodoriModel || 'irodori-tts';
            irodoriVoice.value = configData.irodoriVoice || 'default';
            temperature.value = configData.temperature !== undefined ? Number(configData.temperature) : 0.7;
            
            chatOpacity.value = configData.chatOpacity !== undefined ? Number(configData.chatOpacity) : 1.0;
            
            if (configData.chatAlwaysOnTop === 'sync') {
                chatAlwaysOnTop.value = 'sync';
            } else {
                chatAlwaysOnTop.value = configData.chatAlwaysOnTop !== undefined ? !!configData.chatAlwaysOnTop : true;
            }
            
            chatSendKey.value = configData.chatSendKey || 'enter';
            chatFontFamily.value = configData.chatFontFamily || 'sans-serif';
            chatBorderShow.value = configData.chatBorderShow !== undefined ? !!configData.chatBorderShow : true;
            chatBorderColor.value = configData.chatBorderColor || '#a855f7';
            chatBorderWidth.value = configData.chatBorderWidth !== undefined ? Number(configData.chatBorderWidth) : 1;
            chatBackgroundColor.value = configData.chatBackgroundColor || '#ffffff';
            
            mascotScale.value = configData.mascotScale !== undefined ? Number(configData.mascotScale) : 1.0;
            alwaysOnTop.value = configData.alwaysOnTop !== undefined ? !!configData.alwaysOnTop : true;
            
            useServer.value = configData.useServer !== undefined ? !!configData.useServer : false;
            serverHost.value = configData.serverHost || 'localhost';
            serverPort.value = configData.serverPort !== undefined ? Number(configData.serverPort) : 3000;
            
            useTts.value = configData.useTts !== undefined ? !!configData.useTts : true;
            
            windowMode.value = (configData.windowMode as any) || 'split';
            
            mascots.value = configData.mascots || [];
            activeMascotId.value = configData.activeMascotId || '';

            toolsCurrentTime.value = configData.toolsCurrentTime !== undefined ? !!configData.toolsCurrentTime : true;
            toolsGpsLocation.value = configData.toolsGpsLocation !== undefined ? !!configData.toolsGpsLocation : true;
            toolsWeather.value = configData.toolsWeather !== undefined ? !!configData.toolsWeather : true;
            toolsVolume.value = configData.toolsVolume !== undefined ? !!configData.toolsVolume : true;
            toolsAppLauncher.value = configData.toolsAppLauncher !== undefined ? !!configData.toolsAppLauncher : true;
            toolsWebSearch.value = configData.toolsWebSearch !== undefined ? !!configData.toolsWebSearch : true;
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
            irodoriEndpoint.value = localStorage.getItem('irodoriEndpoint') || 'http://127.0.0.1:8088';
            irodoriModel.value = localStorage.getItem('irodoriModel') || 'irodori-tts';
            irodoriVoice.value = localStorage.getItem('irodoriVoice') || 'default';
            
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
            chatBorderShow.value = localStorage.getItem('chatBorderShow') !== 'false';
            chatBorderColor.value = localStorage.getItem('chatBorderColor') || '#a855f7';
            const savedBorderWidth = localStorage.getItem('chatBorderWidth');
            chatBorderWidth.value = savedBorderWidth ? parseInt(savedBorderWidth) : 1;
            chatBackgroundColor.value = localStorage.getItem('chatBackgroundColor') || '#ffffff';

            const scale = localStorage.getItem('mascotScale');
            mascotScale.value = scale ? parseFloat(scale) : 1.0;
            alwaysOnTop.value = localStorage.getItem('alwaysOnTop') !== 'false';
            
            useServer.value = localStorage.getItem('useServer') === 'true';
            serverHost.value = localStorage.getItem('serverHost') || 'localhost';
            const savedServerPort = localStorage.getItem('serverPort');
            serverPort.value = savedServerPort ? parseInt(savedServerPort) : 3000;
            
            useTts.value = localStorage.getItem('useTts') !== 'false';

            windowMode.value = (localStorage.getItem('windowMode') as any) || 'split';

            const localMascots = localStorage.getItem('mascots');
            mascots.value = localMascots ? JSON.parse(localMascots) : [];
            activeMascotId.value = localStorage.getItem('activeMascotId') || '';

            toolsCurrentTime.value = localStorage.getItem('toolsCurrentTime') !== 'false';
            toolsGpsLocation.value = localStorage.getItem('toolsGpsLocation') !== 'false';
            toolsWeather.value = localStorage.getItem('toolsWeather') !== 'false';
            toolsVolume.value = localStorage.getItem('toolsVolume') !== 'false';
            toolsAppLauncher.value = localStorage.getItem('toolsAppLauncher') !== 'false';
            toolsWebSearch.value = localStorage.getItem('toolsWebSearch') !== 'false';
        }

        // 外部サーバー連携が有効な場合、サーバーから最新の設定を取得してストアを同期
        if (useServer.value) {
            try {
                const serverUrl = `http://${serverHost.value}:${serverPort.value}/api/config`;
                console.log(`[Config] Fetching latest config from server: ${serverUrl}`);
                const response = await fetch(serverUrl, {
                    credentials: 'include'
                });
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
            irodoriEndpoint: irodoriEndpoint.value,
            irodoriModel: irodoriModel.value,
            irodoriVoice: irodoriVoice.value,
            temperature: Number(temperature.value),
            chatOpacity: Number(chatOpacity.value),
            chatAlwaysOnTop: chatAlwaysOnTop.value,
            chatSendKey: chatSendKey.value,
            chatFontFamily: chatFontFamily.value,
            chatBorderShow: chatBorderShow.value,
            chatBorderColor: chatBorderColor.value,
            chatBorderWidth: Number(chatBorderWidth.value),
            chatBackgroundColor: chatBackgroundColor.value,
            mascotScale: Number(mascotScale.value),
            alwaysOnTop: alwaysOnTop.value,
            useServer: useServer.value,
            serverHost: serverHost.value,
            serverPort: Number(serverPort.value),
            useTts: useTts.value,
            windowMode: windowMode.value,
            mascots: JSON.parse(JSON.stringify(mascots.value)),
            activeMascotId: activeMascotId.value,
            toolsCurrentTime: toolsCurrentTime.value,
            toolsGpsLocation: toolsGpsLocation.value,
            toolsWeather: toolsWeather.value,
            toolsVolume: toolsVolume.value,
            toolsAppLauncher: toolsAppLauncher.value,
            toolsWebSearch: toolsWebSearch.value
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
                    body: JSON.stringify(payload),
                    credentials: 'include'
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
        localStorage.setItem('irodoriEndpoint', irodoriEndpoint.value);
        localStorage.setItem('irodoriModel', irodoriModel.value);
        localStorage.setItem('irodoriVoice', irodoriVoice.value);
        localStorage.setItem('temperature', temperature.value.toString());
        localStorage.setItem('chatOpacity', chatOpacity.value.toString());
        localStorage.setItem('chatAlwaysOnTop', chatAlwaysOnTop.value.toString());
        localStorage.setItem('chatSendKey', chatSendKey.value);
        localStorage.setItem('chatFontFamily', chatFontFamily.value);
        localStorage.setItem('chatBorderShow', chatBorderShow.value.toString());
        localStorage.setItem('chatBorderColor', chatBorderColor.value);
        localStorage.setItem('chatBorderWidth', chatBorderWidth.value.toString());
        localStorage.setItem('chatBackgroundColor', chatBackgroundColor.value);
        localStorage.setItem('mascotScale', mascotScale.value.toString());
        localStorage.setItem('alwaysOnTop', alwaysOnTop.value.toString());
        localStorage.setItem('useServer', useServer.value.toString());
        localStorage.setItem('serverHost', serverHost.value);
        localStorage.setItem('serverPort', serverPort.value.toString());
        localStorage.setItem('useTts', useTts.value.toString());
        localStorage.setItem('windowMode', windowMode.value);
        localStorage.setItem('mascots', JSON.stringify(mascots.value));
        localStorage.setItem('activeMascotId', activeMascotId.value);

        localStorage.setItem('toolsCurrentTime', toolsCurrentTime.value.toString());
        localStorage.setItem('toolsGpsLocation', toolsGpsLocation.value.toString());
        localStorage.setItem('toolsWeather', toolsWeather.value.toString());
        localStorage.setItem('toolsVolume', toolsVolume.value.toString());
        localStorage.setItem('toolsAppLauncher', toolsAppLauncher.value.toString());
        localStorage.setItem('toolsWebSearch', toolsWebSearch.value.toString());
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
        if (newConfig.irodoriEndpoint !== undefined) irodoriEndpoint.value = newConfig.irodoriEndpoint;
        if (newConfig.irodoriModel !== undefined) irodoriModel.value = newConfig.irodoriModel;
        if (newConfig.irodoriVoice !== undefined) irodoriVoice.value = newConfig.irodoriVoice;
        if (newConfig.temperature !== undefined) temperature.value = Number(newConfig.temperature);
        
        if (newConfig.chatOpacity !== undefined) chatOpacity.value = Number(newConfig.chatOpacity);
        if (newConfig.chatAlwaysOnTop !== undefined) chatAlwaysOnTop.value = newConfig.chatAlwaysOnTop;
        if (newConfig.chatSendKey !== undefined) chatSendKey.value = newConfig.chatSendKey;
        if (newConfig.chatFontFamily !== undefined) chatFontFamily.value = newConfig.chatFontFamily;
        if (newConfig.chatBorderShow !== undefined) chatBorderShow.value = !!newConfig.chatBorderShow;
        if (newConfig.chatBorderColor !== undefined) chatBorderColor.value = newConfig.chatBorderColor;
        if (newConfig.chatBorderWidth !== undefined) chatBorderWidth.value = Number(newConfig.chatBorderWidth);
        if (newConfig.chatBackgroundColor !== undefined) chatBackgroundColor.value = newConfig.chatBackgroundColor;
        if (newConfig.mascotScale !== undefined) mascotScale.value = Number(newConfig.mascotScale);
        if (newConfig.alwaysOnTop !== undefined) alwaysOnTop.value = !!newConfig.alwaysOnTop;
        if (newConfig.useServer !== undefined) useServer.value = !!newConfig.useServer;
        if (newConfig.serverHost !== undefined) serverHost.value = newConfig.serverHost;
        if (newConfig.serverPort !== undefined) serverPort.value = Number(newConfig.serverPort);
        if (newConfig.useTts !== undefined) useTts.value = !!newConfig.useTts;
        if (newConfig.windowMode !== undefined) windowMode.value = newConfig.windowMode as any;
        
        if (newConfig.mascots !== undefined) mascots.value = newConfig.mascots;
        if (newConfig.activeMascotId !== undefined) activeMascotId.value = newConfig.activeMascotId;

        if (newConfig.toolsCurrentTime !== undefined) toolsCurrentTime.value = !!newConfig.toolsCurrentTime;
        if (newConfig.toolsGpsLocation !== undefined) toolsGpsLocation.value = !!newConfig.toolsGpsLocation;
        if (newConfig.toolsWeather !== undefined) toolsWeather.value = !!newConfig.toolsWeather;
        if (newConfig.toolsVolume !== undefined) toolsVolume.value = !!newConfig.toolsVolume;
        if (newConfig.toolsAppLauncher !== undefined) toolsAppLauncher.value = !!newConfig.toolsAppLauncher;
        if (newConfig.toolsWebSearch !== undefined) toolsWebSearch.value = !!newConfig.toolsWebSearch;
        
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
        irodoriEndpoint,
        irodoriModel,
        irodoriVoice,
        temperature,
        chatOpacity,
        chatAlwaysOnTop,
        chatSendKey,
        chatFontFamily,
        chatBorderShow,
        chatBorderColor,
        chatBorderWidth,
        chatBackgroundColor,
        mascotScale,
        alwaysOnTop,
        useServer,
        serverHost,
        serverPort,
        useTts,
        windowMode,
        mascots,
        activeMascotId,
        activeMascot,
        toolsCurrentTime,
        toolsGpsLocation,
        toolsWeather,
        toolsVolume,
        toolsAppLauncher,
        toolsWebSearch,
        configVersion,
        loadConfig,
        saveConfig,
        updateConfig
    };
});
