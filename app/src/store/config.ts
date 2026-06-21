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
    chatBackgroundImage: string;
    chatBackgroundImageOpacity: number;
    chatBackgroundImageFit: 'cover' | 'contain' | 'fill' | 'tile';
    
    // マスコット設定
    mascotScale: number;
    alwaysOnTop: boolean;
    mascotBackgroundColor: string;
    mascotBackgroundOpacity: number;
    mascotBackgroundImage: string;
    mascotBackgroundImageOpacity: number;
    mascotBackgroundImageFit: 'cover' | 'contain' | 'fill' | 'tile';
    integratedBackgroundColor: string;
    integratedBackgroundOpacity: number;
    integratedBackgroundImage: string;
    integratedBackgroundImageOpacity: number;
    integratedBackgroundImageFit: 'cover' | 'contain' | 'fill' | 'tile';
    
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

    integratedWidth?: number;
    integratedHeight?: number;
    integratedX?: number;
    integratedY?: number;
    compactWidth?: number;
    compactHeight?: number;
    compactX?: number;
    compactY?: number;
    chatWidth?: number;
    chatHeight?: number;

    // ツール使用設定 (ToolUse)
    toolsCurrentTime: boolean;
    toolsGpsLocation: boolean;
    toolsWeather: boolean;
    toolsVolume: boolean;
    toolsAppLauncher: boolean;
    toolsWebSearch: boolean;
    useExRadio: boolean;
    saveVoice?: boolean;
    showVoiceLog?: boolean;
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
    const chatBackgroundImage = ref('');
    const chatBackgroundImageOpacity = ref(1.0);
    const chatBackgroundImageFit = ref<'cover' | 'contain' | 'fill' | 'tile'>('cover');
    
    // マスコット設定
    const mascotScale = ref(1.0);
    const alwaysOnTop = ref(true);
    const mascotBackgroundColor = ref('#ffffff');
    const mascotBackgroundOpacity = ref(0.0);
    const mascotBackgroundImage = ref('');
    const mascotBackgroundImageOpacity = ref(1.0);
    const mascotBackgroundImageFit = ref<'cover' | 'contain' | 'fill' | 'tile'>('cover');
    
    // 統合ウィンドウ背景設定
    const integratedBackgroundColor = ref('#1e1e2e');
    const integratedBackgroundOpacity = ref(1.0);
    const integratedBackgroundImage = ref('');
    const integratedBackgroundImageOpacity = ref(1.0);
    const integratedBackgroundImageFit = ref<'cover' | 'contain' | 'fill' | 'tile'>('cover');

    // サーバー接続設定
    const useServer = ref(false);
    const serverHost = ref('localhost');
    const serverPort = ref(3000);

    // TTS設定
    const useTts = ref(true);

    // ウィンドウモード
    const windowMode = ref<'split' | 'integrated' | 'compact'>('split');

    // 統合・コンパクトウィンドウのサイズと位置
    const integratedWidth = ref(1100);
    const integratedHeight = ref(800);
    const integratedX = ref(-1);
    const integratedY = ref(-1);
    const compactWidth = ref(420);
    const compactHeight = ref(800);
    const compactX = ref(-1);
    const compactY = ref(-1);
    const chatWidth = ref(350);
    const chatHeight = ref(400);

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
    const useExRadio = ref(false);
    const saveVoice = ref(false);
    const showVoiceLog = ref(true);
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

        // Nitro API から設定の取得を試みる
        try {
            console.log('[Config] Loading config from local Nitro API...');
            const response = await fetch('/api/config', {
                credentials: 'include'
            });
            if (response.ok) {
                const resJson = await response.json();
                if (resJson.success && resJson.config && Object.keys(resJson.config).length > 0) {
                    configData = resJson.config;
                    console.log('[Config] Config loaded from local Nitro API');
                }
            }
        } catch (e: any) {
            console.warn('[Config] Failed to fetch config from local Nitro API:', e.message);
        }

        // サーバーから取得できなかった場合は Electron API から試みる
        if (!configData && window.electronAPI) {
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
            chatBackgroundImage.value = configData.chatBackgroundImage || '';
            chatBackgroundImageOpacity.value = configData.chatBackgroundImageOpacity !== undefined ? Number(configData.chatBackgroundImageOpacity) : 1.0;
            chatBackgroundImageFit.value = configData.chatBackgroundImageFit || 'cover';
            
            mascotScale.value = configData.mascotScale !== undefined ? Number(configData.mascotScale) : 1.0;
            alwaysOnTop.value = configData.alwaysOnTop !== undefined ? !!configData.alwaysOnTop : true;
            mascotBackgroundColor.value = configData.mascotBackgroundColor || '#ffffff';
            mascotBackgroundOpacity.value = configData.mascotBackgroundOpacity !== undefined ? Number(configData.mascotBackgroundOpacity) : 0.0;
            mascotBackgroundImage.value = configData.mascotBackgroundImage || '';
            mascotBackgroundImageOpacity.value = configData.mascotBackgroundImageOpacity !== undefined ? Number(configData.mascotBackgroundImageOpacity) : 1.0;
            mascotBackgroundImageFit.value = configData.mascotBackgroundImageFit || 'cover';
            
            integratedBackgroundColor.value = configData.integratedBackgroundColor || '#1e1e2e';
            integratedBackgroundOpacity.value = configData.integratedBackgroundOpacity !== undefined ? Number(configData.integratedBackgroundOpacity) : 1.0;
            integratedBackgroundImage.value = configData.integratedBackgroundImage || '';
            integratedBackgroundImageOpacity.value = configData.integratedBackgroundImageOpacity !== undefined ? Number(configData.integratedBackgroundImageOpacity) : 1.0;
            integratedBackgroundImageFit.value = configData.integratedBackgroundImageFit || 'cover';
            
            useServer.value = configData.useServer !== undefined ? !!configData.useServer : false;
            serverHost.value = configData.serverHost || 'localhost';
            serverPort.value = configData.serverPort !== undefined ? Number(configData.serverPort) : 3000;
            
            useTts.value = configData.useTts !== undefined ? !!configData.useTts : true;
            
            windowMode.value = (configData.windowMode as any) || 'split';
            
            integratedWidth.value = configData.integratedWidth !== undefined ? Number(configData.integratedWidth) : 1100;
            integratedHeight.value = configData.integratedHeight !== undefined ? Number(configData.integratedHeight) : 800;
            integratedX.value = configData.integratedX !== undefined ? Number(configData.integratedX) : -1;
            integratedY.value = configData.integratedY !== undefined ? Number(configData.integratedY) : -1;
            compactWidth.value = configData.compactWidth !== undefined ? Number(configData.compactWidth) : 420;
            compactHeight.value = configData.compactHeight !== undefined ? Number(configData.compactHeight) : 800;
            compactX.value = configData.compactX !== undefined ? Number(configData.compactX) : -1;
            compactY.value = configData.compactY !== undefined ? Number(configData.compactY) : -1;
            chatWidth.value = configData.chatWidth !== undefined ? Number(configData.chatWidth) : 350;
            chatHeight.value = configData.chatHeight !== undefined ? Number(configData.chatHeight) : 400;

            mascots.value = configData.mascots || [];
            activeMascotId.value = configData.activeMascotId || '';

            toolsCurrentTime.value = configData.toolsCurrentTime !== undefined ? !!configData.toolsCurrentTime : true;
            toolsGpsLocation.value = configData.toolsGpsLocation !== undefined ? !!configData.toolsGpsLocation : true;
            toolsWeather.value = configData.toolsWeather !== undefined ? !!configData.toolsWeather : true;
            toolsVolume.value = configData.toolsVolume !== undefined ? !!configData.toolsVolume : true;
            toolsAppLauncher.value = configData.toolsAppLauncher !== undefined ? !!configData.toolsAppLauncher : true;
            toolsWebSearch.value = configData.toolsWebSearch !== undefined ? !!configData.toolsWebSearch : true;
            useExRadio.value = configData.useExRadio !== undefined ? !!configData.useExRadio : false;
            saveVoice.value = configData.saveVoice !== undefined ? !!configData.saveVoice : false;
            showVoiceLog.value = configData.showVoiceLog !== undefined ? !!configData.showVoiceLog : true;
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
            chatBackgroundImage.value = localStorage.getItem('chatBackgroundImage') || '';
            const bgOpacity = localStorage.getItem('chatBackgroundImageOpacity');
            chatBackgroundImageOpacity.value = bgOpacity ? parseFloat(bgOpacity) : 1.0;
            chatBackgroundImageFit.value = (localStorage.getItem('chatBackgroundImageFit') as any) || 'cover';

            const scale = localStorage.getItem('mascotScale');
            mascotScale.value = scale ? parseFloat(scale) : 1.0;
            alwaysOnTop.value = localStorage.getItem('alwaysOnTop') !== 'false';
            mascotBackgroundColor.value = localStorage.getItem('mascotBackgroundColor') || '#ffffff';
            const mBgOpacity = localStorage.getItem('mascotBackgroundOpacity');
            mascotBackgroundOpacity.value = mBgOpacity ? parseFloat(mBgOpacity) : 0.0;
            mascotBackgroundImage.value = localStorage.getItem('mascotBackgroundImage') || '';
            const mBgImgOpacity = localStorage.getItem('mascotBackgroundImageOpacity');
            mascotBackgroundImageOpacity.value = mBgImgOpacity ? parseFloat(mBgImgOpacity) : 1.0;
            mascotBackgroundImageFit.value = (localStorage.getItem('mascotBackgroundImageFit') as any) || 'cover';
            
            integratedBackgroundColor.value = localStorage.getItem('integratedBackgroundColor') || '#1e1e2e';
            const iBgOpacity = localStorage.getItem('integratedBackgroundOpacity');
            integratedBackgroundOpacity.value = iBgOpacity ? parseFloat(iBgOpacity) : 1.0;
            integratedBackgroundImage.value = localStorage.getItem('integratedBackgroundImage') || '';
            const iBgImgOpacity = localStorage.getItem('integratedBackgroundImageOpacity');
            integratedBackgroundImageOpacity.value = iBgImgOpacity ? parseFloat(iBgImgOpacity) : 1.0;
            integratedBackgroundImageFit.value = (localStorage.getItem('integratedBackgroundImageFit') as any) || 'cover';
            
            useServer.value = localStorage.getItem('useServer') === 'true';
            serverHost.value = localStorage.getItem('serverHost') || 'localhost';
            const savedServerPort = localStorage.getItem('serverPort');
            serverPort.value = savedServerPort ? parseInt(savedServerPort) : 3000;
            
            useTts.value = localStorage.getItem('useTts') !== 'false';

            windowMode.value = (localStorage.getItem('windowMode') as any) || 'split';

            integratedWidth.value = Number(localStorage.getItem('integratedWidth') || '1100');
            integratedHeight.value = Number(localStorage.getItem('integratedHeight') || '800');
            integratedX.value = Number(localStorage.getItem('integratedX') || '-1');
            integratedY.value = Number(localStorage.getItem('integratedY') || '-1');
            compactWidth.value = Number(localStorage.getItem('compactWidth') || '420');
            compactHeight.value = Number(localStorage.getItem('compactHeight') || '800');
            compactX.value = Number(localStorage.getItem('compactX') || '-1');
            compactY.value = Number(localStorage.getItem('compactY') || '-1');
            chatWidth.value = Number(localStorage.getItem('chatWidth') || '350');
            chatHeight.value = Number(localStorage.getItem('chatHeight') || '400');

            const localMascots = localStorage.getItem('mascots');
            mascots.value = localMascots ? JSON.parse(localMascots) : [];
            activeMascotId.value = localStorage.getItem('activeMascotId') || '';

            toolsCurrentTime.value = localStorage.getItem('toolsCurrentTime') !== 'false';
            toolsGpsLocation.value = localStorage.getItem('toolsGpsLocation') !== 'false';
            toolsWeather.value = localStorage.getItem('toolsWeather') !== 'false';
            toolsVolume.value = localStorage.getItem('toolsVolume') !== 'false';
            toolsAppLauncher.value = localStorage.getItem('toolsAppLauncher') !== 'false';
            toolsWebSearch.value = localStorage.getItem('toolsWebSearch') !== 'false';
            useExRadio.value = localStorage.getItem('useExRadio') === 'true';
            saveVoice.value = localStorage.getItem('saveVoice') === 'true';
            showVoiceLog.value = localStorage.getItem('showVoiceLog') !== 'false';
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
            chatBackgroundImage: chatBackgroundImage.value,
            chatBackgroundImageOpacity: Number(chatBackgroundImageOpacity.value),
            chatBackgroundImageFit: chatBackgroundImageFit.value,
            mascotScale: Number(mascotScale.value),
            alwaysOnTop: alwaysOnTop.value,
            mascotBackgroundColor: mascotBackgroundColor.value,
            mascotBackgroundOpacity: Number(mascotBackgroundOpacity.value),
            mascotBackgroundImage: mascotBackgroundImage.value,
            mascotBackgroundImageOpacity: Number(mascotBackgroundImageOpacity.value),
            mascotBackgroundImageFit: mascotBackgroundImageFit.value,
            integratedBackgroundColor: integratedBackgroundColor.value,
            integratedBackgroundOpacity: Number(integratedBackgroundOpacity.value),
            integratedBackgroundImage: integratedBackgroundImage.value,
            integratedBackgroundImageOpacity: Number(integratedBackgroundImageOpacity.value),
            integratedBackgroundImageFit: integratedBackgroundImageFit.value,
            useServer: useServer.value,
            serverHost: serverHost.value,
            serverPort: Number(serverPort.value),
            useTts: useTts.value,
            windowMode: windowMode.value,
            integratedWidth: Number(integratedWidth.value),
            integratedHeight: Number(integratedHeight.value),
            integratedX: Number(integratedX.value),
            integratedY: Number(integratedY.value),
            compactWidth: Number(compactWidth.value),
            compactHeight: Number(compactHeight.value),
            compactX: Number(compactX.value),
            compactY: Number(compactY.value),
            chatWidth: Number(chatWidth.value),
            chatHeight: Number(chatHeight.value),
            mascots: JSON.parse(JSON.stringify(mascots.value)),
            activeMascotId: activeMascotId.value,
            toolsCurrentTime: toolsCurrentTime.value,
            toolsGpsLocation: toolsGpsLocation.value,
            toolsWeather: toolsWeather.value,
            toolsVolume: toolsVolume.value,
            toolsAppLauncher: toolsAppLauncher.value,
            toolsWebSearch: toolsWebSearch.value,
            useExRadio: useExRadio.value,
            saveVoice: saveVoice.value,
            showVoiceLog: showVoiceLog.value
        };

        // ローカルサーバー（Nitro）に設定データを送信して一元保存
        let savedPayload = payload;
        try {
            console.log('[Config] Saving config to local Nitro API...');
            const response = await fetch('/api/config', {
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
                    console.log('[Config] Config successfully saved to local Nitro API');
                    updateConfig(resJson.config);
                    savedPayload = resJson.config;
                }
            }
        } catch (e: any) {
            console.warn('[Config] Failed to save config to local Nitro API:', e.message);
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
        localStorage.setItem('chatBackgroundImage', chatBackgroundImage.value);
        localStorage.setItem('chatBackgroundImageOpacity', chatBackgroundImageOpacity.value.toString());
        localStorage.setItem('chatBackgroundImageFit', chatBackgroundImageFit.value);
        localStorage.setItem('mascotScale', mascotScale.value.toString());
        localStorage.setItem('alwaysOnTop', alwaysOnTop.value.toString());
        localStorage.setItem('mascotBackgroundColor', mascotBackgroundColor.value);
        localStorage.setItem('mascotBackgroundOpacity', mascotBackgroundOpacity.value.toString());
        localStorage.setItem('mascotBackgroundImage', mascotBackgroundImage.value);
        localStorage.setItem('mascotBackgroundImageOpacity', mascotBackgroundImageOpacity.value.toString());
        localStorage.setItem('mascotBackgroundImageFit', mascotBackgroundImageFit.value);
        localStorage.setItem('integratedBackgroundColor', integratedBackgroundColor.value);
        localStorage.setItem('integratedBackgroundOpacity', integratedBackgroundOpacity.value.toString());
        localStorage.setItem('integratedBackgroundImage', integratedBackgroundImage.value);
        localStorage.setItem('integratedBackgroundImageOpacity', integratedBackgroundImageOpacity.value.toString());
        localStorage.setItem('integratedBackgroundImageFit', integratedBackgroundImageFit.value);
        localStorage.setItem('useServer', useServer.value.toString());
        localStorage.setItem('serverHost', serverHost.value);
        localStorage.setItem('serverPort', serverPort.value.toString());
        localStorage.setItem('useTts', useTts.value.toString());
        localStorage.setItem('windowMode', windowMode.value);
        localStorage.setItem('integratedWidth', integratedWidth.value.toString());
        localStorage.setItem('integratedHeight', integratedHeight.value.toString());
        localStorage.setItem('integratedX', integratedX.value.toString());
        localStorage.setItem('integratedY', integratedY.value.toString());
        localStorage.setItem('compactWidth', compactWidth.value.toString());
        localStorage.setItem('compactHeight', compactHeight.value.toString());
        localStorage.setItem('compactX', compactX.value.toString());
        localStorage.setItem('compactY', compactY.value.toString());
        localStorage.setItem('chatWidth', chatWidth.value.toString());
        localStorage.setItem('chatHeight', chatHeight.value.toString());
        localStorage.setItem('mascots', JSON.stringify(mascots.value));
        localStorage.setItem('activeMascotId', activeMascotId.value);

        localStorage.setItem('toolsCurrentTime', toolsCurrentTime.value.toString());
        localStorage.setItem('toolsGpsLocation', toolsGpsLocation.value.toString());
        localStorage.setItem('toolsWeather', toolsWeather.value.toString());
        localStorage.setItem('toolsVolume', toolsVolume.value.toString());
        localStorage.setItem('toolsAppLauncher', toolsAppLauncher.value.toString());
        localStorage.setItem('toolsWebSearch', toolsWebSearch.value.toString());
        localStorage.setItem('useExRadio', useExRadio.value.toString());
        localStorage.setItem('saveVoice', saveVoice.value.toString());
        localStorage.setItem('showVoiceLog', showVoiceLog.value.toString());
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
        if (newConfig.chatBackgroundImage !== undefined) chatBackgroundImage.value = newConfig.chatBackgroundImage;
        if (newConfig.chatBackgroundImageOpacity !== undefined) chatBackgroundImageOpacity.value = Number(newConfig.chatBackgroundImageOpacity);
        if (newConfig.chatBackgroundImageFit !== undefined) chatBackgroundImageFit.value = newConfig.chatBackgroundImageFit as any;
        if (newConfig.mascotScale !== undefined) mascotScale.value = Number(newConfig.mascotScale);
        if (newConfig.alwaysOnTop !== undefined) alwaysOnTop.value = !!newConfig.alwaysOnTop;
        if (newConfig.mascotBackgroundColor !== undefined) mascotBackgroundColor.value = newConfig.mascotBackgroundColor;
        if (newConfig.mascotBackgroundOpacity !== undefined) mascotBackgroundOpacity.value = Number(newConfig.mascotBackgroundOpacity);
        if (newConfig.mascotBackgroundImage !== undefined) mascotBackgroundImage.value = newConfig.mascotBackgroundImage;
        if (newConfig.mascotBackgroundImageOpacity !== undefined) mascotBackgroundImageOpacity.value = Number(newConfig.mascotBackgroundImageOpacity);
        if (newConfig.mascotBackgroundImageFit !== undefined) mascotBackgroundImageFit.value = newConfig.mascotBackgroundImageFit as any;
        if (newConfig.integratedBackgroundColor !== undefined) integratedBackgroundColor.value = newConfig.integratedBackgroundColor;
        if (newConfig.integratedBackgroundOpacity !== undefined) integratedBackgroundOpacity.value = Number(newConfig.integratedBackgroundOpacity);
        if (newConfig.integratedBackgroundImage !== undefined) integratedBackgroundImage.value = newConfig.integratedBackgroundImage;
        if (newConfig.integratedBackgroundImageOpacity !== undefined) integratedBackgroundImageOpacity.value = Number(newConfig.integratedBackgroundImageOpacity);
        if (newConfig.integratedBackgroundImageFit !== undefined) integratedBackgroundImageFit.value = newConfig.integratedBackgroundImageFit as any;
        if (newConfig.useServer !== undefined) useServer.value = !!newConfig.useServer;
        if (newConfig.serverHost !== undefined) serverHost.value = newConfig.serverHost;
        if (newConfig.serverPort !== undefined) serverPort.value = Number(newConfig.serverPort);
        if (newConfig.useTts !== undefined) useTts.value = !!newConfig.useTts;
        if (newConfig.windowMode !== undefined) windowMode.value = newConfig.windowMode as any;
        if (newConfig.integratedWidth !== undefined) integratedWidth.value = Number(newConfig.integratedWidth);
        if (newConfig.integratedHeight !== undefined) integratedHeight.value = Number(newConfig.integratedHeight);
        if (newConfig.integratedX !== undefined) integratedX.value = Number(newConfig.integratedX);
        if (newConfig.integratedY !== undefined) integratedY.value = Number(newConfig.integratedY);
        if (newConfig.compactWidth !== undefined) compactWidth.value = Number(newConfig.compactWidth);
        if (newConfig.compactHeight !== undefined) compactHeight.value = Number(newConfig.compactHeight);
        if (newConfig.compactX !== undefined) compactX.value = Number(newConfig.compactX);
        if (newConfig.compactY !== undefined) compactY.value = Number(newConfig.compactY);
        if (newConfig.chatWidth !== undefined) chatWidth.value = Number(newConfig.chatWidth);
        if (newConfig.chatHeight !== undefined) chatHeight.value = Number(newConfig.chatHeight);
        
        if (newConfig.mascots !== undefined) mascots.value = newConfig.mascots;
        if (newConfig.activeMascotId !== undefined) activeMascotId.value = newConfig.activeMascotId;

        if (newConfig.toolsCurrentTime !== undefined) toolsCurrentTime.value = !!newConfig.toolsCurrentTime;
        if (newConfig.toolsGpsLocation !== undefined) toolsGpsLocation.value = !!newConfig.toolsGpsLocation;
        if (newConfig.toolsWeather !== undefined) toolsWeather.value = !!newConfig.toolsWeather;
        if (newConfig.toolsVolume !== undefined) toolsVolume.value = !!newConfig.toolsVolume;
        if (newConfig.toolsAppLauncher !== undefined) toolsAppLauncher.value = !!newConfig.toolsAppLauncher;
        if (newConfig.toolsWebSearch !== undefined) toolsWebSearch.value = !!newConfig.toolsWebSearch;
        if (newConfig.useExRadio !== undefined) useExRadio.value = !!newConfig.useExRadio;
        if (newConfig.saveVoice !== undefined) saveVoice.value = !!newConfig.saveVoice;
        if (newConfig.showVoiceLog !== undefined) showVoiceLog.value = !!newConfig.showVoiceLog;
        
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
        chatBackgroundImage,
        chatBackgroundImageOpacity,
        chatBackgroundImageFit,
        mascotScale,
        alwaysOnTop,
        mascotBackgroundColor,
        mascotBackgroundOpacity,
        mascotBackgroundImage,
        mascotBackgroundImageOpacity,
        mascotBackgroundImageFit,
        integratedBackgroundColor,
        integratedBackgroundOpacity,
        integratedBackgroundImage,
        integratedBackgroundImageOpacity,
        integratedBackgroundImageFit,
        useServer,
        serverHost,
        serverPort,
        useTts,
        windowMode,
        integratedWidth,
        integratedHeight,
        integratedX,
        integratedY,
        compactWidth,
        compactHeight,
        compactX,
        compactY,
        chatWidth,
        chatHeight,
        mascots,
        activeMascotId,
        activeMascot,
        toolsCurrentTime,
        toolsGpsLocation,
        toolsWeather,
        toolsVolume,
        toolsAppLauncher,
        toolsWebSearch,
        useExRadio,
        saveVoice,
        showVoiceLog,
        configVersion,
        loadConfig,
        saveConfig,
        updateConfig
    };
});
