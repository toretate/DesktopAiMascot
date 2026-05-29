<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import Card from 'primevue/card';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Select from 'primevue/select';
import Slider from 'primevue/slider';
import InputText from 'primevue/inputtext';

const activeMenu = ref('mascot');

// --- AIエンジンのデータ定義 ---
const aiEngines = ref([
    { name: 'Gemini AI Studio', value: 'gemini' },
    { name: 'LM Studio (ローカル)', value: 'lmstudio' },
    { name: 'OpenAI (GPT-4o)', value: 'openai' },
    { name: 'Claude (Anthropic)', value: 'anthropic' }
]);
const selectedEngine = ref('gemini');

// 音声AIエンジン
const voiceEngines = ref([
    { name: 'VOICEVOX (ローカル)', value: 'voicevox' },
    { name: 'Google Cloud Text-to-Speech', value: 'gtts' }
]);
const selectedVoiceEngine = ref('voicevox');

// 画像生成AI
const imageEngines = ref([
    { name: 'DALL-E 3 (OpenAI)', value: 'dalle3' },
    { name: 'Stable Diffusion (ローカル)', value: 'sd_local' },
    { name: 'Midjourney API', value: 'midjourney' }
]);
const selectedImageEngine = ref('dalle3');

// 動画生成AI
const videoEngines = ref([
    { name: 'Runway Gen-2', value: 'runway' },
    { name: 'Stable Video Diffusion', value: 'svd' },
    { name: 'Sora (OpenAI モック)', value: 'sora' }
]);
const selectedVideoEngine = ref('runway');

const temperature = ref(0.7);
const geminiApiKey = ref('');
const lmstudioEndpoint = ref('http://127.0.0.1:1234/v1/');
const lmstudioModel = ref('');
const geminiModel = ref('gemini-2.0-flash-exp');
const openaiModel = ref('gpt-4o');
const anthropicModel = ref('claude-3-5-sonnet-latest');

// LM Studio 接続検証用の状態変数
const isTestingConnection = ref(false);
const connectionState = ref<'idle' | 'success' | 'failed'>('idle');
const connectionErrorMsg = ref('');
const lmstudioModels = ref<string[]>([]);

// VOICEVOX 疎通確認および話者ロード用の状態変数
const voicevoxEndpoint = ref('http://localhost:50021');
const voicevoxSpeaker = ref<any>(2); // デフォルト話者ID: 2 (四国めたんノーマル)
const isTestingVoicevox = ref(false);
const voicevoxConnectionState = ref<'idle' | 'success' | 'failed'>('idle');
const voicevoxConnectionErrorMsg = ref('');
const voicevoxSpeakers = ref<{ name: string; value: number }[]>([]);

const saveStatus = ref('設定を保存');
const isSaving = ref(false);

// LM Studio 疎通確認とモデル一覧のロード処理
const testLmStudioConnection = async () => {
    isTestingConnection.value = true;
    connectionState.value = 'idle';
    connectionErrorMsg.value = '';
    
    if (window.electronAPI) {
        try {
            const result = await window.electronAPI.getLmStudioModels(lmstudioEndpoint.value);
            if (result.success) {
                connectionState.value = 'success';
                lmstudioModels.value = result.models;
                // 現在選択されているモデル名が空で、ロードされたモデルがあれば自動セット
                if (!lmstudioModel.value && result.models.length > 0) {
                    lmstudioModel.value = result.models[0];
                }
            } else {
                connectionState.value = 'failed';
                connectionErrorMsg.value = result.error || '接続に失敗しました。';
                lmstudioModels.value = [];
            }
        } catch (e: any) {
            connectionState.value = 'failed';
            connectionErrorMsg.value = '通信エラーが発生しました。';
            lmstudioModels.value = [];
        }
    } else {
        // ブラウザ実行時（デモ用モック）
        await new Promise((resolve) => setTimeout(resolve, 1000));
        connectionState.value = 'success';
        lmstudioModels.value = ['meta-llama-3-8b-instruct', 'mistral-7b-instruct-v0.2'];
        if (!lmstudioModel.value) {
            lmstudioModel.value = 'meta-llama-3-8b-instruct';
        }
    }
    isTestingConnection.value = false;
};

// VOICEVOX 疎通確認と話者（モデル）スタイル一覧のロード処理
const testVoicevoxConnection = async () => {
    isTestingVoicevox.value = true;
    voicevoxConnectionState.value = 'idle';
    voicevoxConnectionErrorMsg.value = '';
    
    if (window.electronAPI) {
        try {
            const result = await window.electronAPI.getVoicevoxSpeakers(voicevoxEndpoint.value);
            if (result.success) {
                voicevoxConnectionState.value = 'success';
                voicevoxSpeakers.value = result.speakers;
                // 現在選択されている話者IDが取得リストに存在しない場合、最初のスタイルを自動選択
                const hasSpeaker = result.speakers.some((s) => s.value === voicevoxSpeaker.value);
                if (!hasSpeaker && result.speakers.length > 0) {
                    voicevoxSpeaker.value = result.speakers[0].value;
                }
            } else {
                voicevoxConnectionState.value = 'failed';
                voicevoxConnectionErrorMsg.value = result.error || '接続に失敗しました。';
                voicevoxSpeakers.value = [];
            }
        } catch (e: any) {
            voicevoxConnectionState.value = 'failed';
            voicevoxConnectionErrorMsg.value = '通信エラーが発生しました。';
            voicevoxSpeakers.value = [];
        }
    } else {
        // ブラウザ実行時（デモ用モック）
        await new Promise((resolve) => setTimeout(resolve, 1000));
        voicevoxConnectionState.value = 'success';
        voicevoxSpeakers.value = [
            { name: '四国めたん (ノーマル)', value: 2 },
            { name: '四国めたん (あまあま)', value: 0 },
            { name: 'ずんだもん (ノーマル)', value: 3 },
            { name: 'ずんだもん (あまあま)', value: 1 }
        ];
    }
    isTestingVoicevox.value = false;
};

// 疎通確認ステータスに応じた動的クラスおよびテキスト
const connectionClass = computed(() => {
    if (connectionState.value === 'success') return 'status-success';
    if (connectionState.value === 'failed') return 'status-failed';
    return 'status-idle';
});

const connectionIcon = computed(() => {
    if (connectionState.value === 'success') return 'pi pi-check-circle text-green-400';
    if (connectionState.value === 'failed') return 'pi pi-times-circle text-red-400';
    return 'pi pi-info-circle text-gray-400';
});

const connectionText = computed(() => {
    if (connectionState.value === 'success') return `接続成功 (ロード済みモデル数: ${lmstudioModels.value.length})`;
    if (connectionState.value === 'failed') return `接続失敗: ${connectionErrorMsg.value}`;
    return 'エンドポイントを入力して接続テストを行ってください。';
});

// VOICEVOX用疎通確認表示Computed
const voicevoxConnectionClass = computed(() => {
    if (voicevoxConnectionState.value === 'success') return 'status-success';
    if (voicevoxConnectionState.value === 'failed') return 'status-failed';
    return 'status-idle';
});

const voicevoxConnectionIcon = computed(() => {
    if (voicevoxConnectionState.value === 'success') return 'pi pi-check-circle text-green-400';
    if (voicevoxConnectionState.value === 'failed') return 'pi pi-times-circle text-red-400';
    return 'pi pi-info-circle text-gray-400';
});

const voicevoxConnectionText = computed(() => {
    if (voicevoxConnectionState.value === 'success') return `接続成功 (スタイル数: ${voicevoxSpeakers.value.length})`;
    if (voicevoxConnectionState.value === 'failed') return `接続失敗: ${voicevoxConnectionErrorMsg.value}`;
    return 'エンドポイントを入力して接続テストを行ってください。';
});

// 設定データのロード
onMounted(async () => {
    let configData: any = null;
    if (window.electronAPI) {
        configData = await window.electronAPI.getAppConfig();
    }

    if (configData) {
        // メインプロセスの config.json からロード
        geminiApiKey.value = configData.googleAiStudioApiKey || '';
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
        voicevoxSpeaker.value = configData.voicevoxSpeaker !== undefined ? configData.voicevoxSpeaker : 2;
        temperature.value = configData.temperature !== undefined ? configData.temperature : 0.7;
    } else {
        // Webブラウザ/モック環境（localStorageフォールバック）
        geminiApiKey.value = localStorage.getItem('GoogleAiStudioApiKey') || '';
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
        if (temp) {
            temperature.value = parseFloat(temp);
        }
    }

    // LM Studio が現在のアクティブエンジンの場合、初期表示時に自動で疎通確認を実行
    if (selectedEngine.value === 'lmstudio') {
        testLmStudioConnection();
    }
    
    // 音声エンジンが voicevox の場合、初期表示時に自動で疎通確認を実行
    if (selectedVoiceEngine.value === 'voicevox') {
        testVoicevoxConnection();
    }
});

// 設定の保存処理
const saveSettings = async () => {
    isSaving.value = true;
    saveStatus.value = '保存中...';

    // 1. ローカルファイルの更新（メインプロセス経由）
    if (window.electronAPI) {
        await window.electronAPI.updateAppConfig({
            googleAiStudioApiKey: geminiApiKey.value,
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
            temperature: Number(temperature.value)
        });
    }

    // 2. localStorageへの同時書き込み (下位互換および二重化保持)
    localStorage.setItem('GoogleAiStudioApiKey', geminiApiKey.value);
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

    setTimeout(() => {
        saveStatus.value = '保存完了！';
        isSaving.value = false;
        setTimeout(() => {
            saveStatus.value = '設定を保存';
        }, 2000);
    }, 600);
};

// アプリケーション終了の処理
const quitApp = () => {
    if (window.electronAPI) {
        window.electronAPI.quitApp();
    }
};
</script>

<template>
    <div class="settings-layout app-dark">
        <!-- 1. 左サイドバー -->
        <aside class="sidebar drag-area">
            <div class="brand no-drag">
                <span class="logo">🤖</span>
                <div class="brand-text">
                    <h2>Mascot App</h2>
                    <p>環境設定</p>
                </div>
            </div>

            <!-- ナビゲーションメニュー -->
            <nav class="menu no-drag">
                <button 
                    class="menu-item" 
                    :class="{ active: activeMenu === 'mascot' }"
                    @click="activeMenu = 'mascot'"
                >
                    <i class="pi pi-user"></i>
                    <span>マスコット</span>
                </button>
                <button 
                    class="menu-item" 
                    :class="{ active: activeMenu === 'chat' }"
                    @click="activeMenu = 'chat'"
                >
                    <i class="pi pi-comments"></i>
                    <span>チャットAI</span>
                </button>
                <button 
                    class="menu-item" 
                    :class="{ active: activeMenu === 'voice' }"
                    @click="activeMenu = 'voice'"
                >
                    <i class="pi pi-volume-up"></i>
                    <span>音声AI</span>
                </button>
                <button 
                    class="menu-item" 
                    :class="{ active: activeMenu === 'image' }"
                    @click="activeMenu = 'image'"
                >
                    <i class="pi pi-image"></i>
                    <span>画像AI</span>
                </button>
                <button 
                    class="menu-item" 
                    :class="{ active: activeMenu === 'video' }"
                    @click="activeMenu = 'video'"
                >
                    <i class="pi pi-video"></i>
                    <span>動画AI</span>
                </button>
                <button 
                    class="menu-item" 
                    :class="{ active: activeMenu === 'apikey' }"
                    @click="activeMenu = 'apikey'"
                >
                    <i class="pi pi-key"></i>
                    <span>APIキー</span>
                </button>
            </nav>

            <!-- 最下部：アプリ終了ボタン -->
            <div class="sidebar-footer no-drag">
                <button class="quit-btn" @click="quitApp">
                    <i class="pi pi-power-off"></i>
                    <span>アプリ終了</span>
                </button>
            </div>
        </aside>

        <!-- 2. 右側メインコンテンツエリア -->
        <main class="main-content">
            <div class="content-container">
                <!-- パネル1: マスコット -->
                <div v-if="activeMenu === 'mascot'" class="panel-section">
                    <Card class="premium-card">
                        <template #title>マスコット設定</template>
                        <template #content>
                            <div class="mascot-list">
                                <div class="mascot-item active">
                                    <span class="avatar">🤖</span>
                                    <div class="info">
                                        <span class="name">デフォルトロボット</span>
                                        <span class="desc">親しみやすいベーシックなAIマスコットです。</span>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </Card>
                </div>

                <!-- パネル2: チャットAI -->
                <div v-else-if="activeMenu === 'chat'" class="panel-section">
                    <Card class="premium-card">
                        <template #title>チャットAIエンジン設定</template>
                        <template #content>
                            <div class="flex flex-column gap-4">
                                <div class="form-field">
                                    <label class="font-medium">使用AIエンジン</label>
                                    <Select 
                                        v-model="selectedEngine" 
                                        :options="aiEngines" 
                                        optionLabel="name" 
                                        optionValue="value" 
                                        class="w-full" 
                                    />
                                </div>
                                
                                <!-- LM Studio エンドポイント (チャットAIパネルに統合) -->
                                <div v-if="selectedEngine === 'lmstudio'" class="form-field mt-3">
                                    <label class="font-medium">LM Studio エンドポイント</label>
                                    <div class="flex gap-2 w-full">
                                        <InputText 
                                            v-model="lmstudioEndpoint" 
                                            placeholder="http://127.0.0.1:1234/v1/" 
                                            class="flex-1"
                                        />
                                        <Button 
                                            icon="pi pi-sync" 
                                            class="p-button-secondary" 
                                            title="疎通確認とモデル一覧再読み込み"
                                            :loading="isTestingConnection"
                                            @click="testLmStudioConnection" 
                                        />
                                    </div>
                                    
                                    <!-- 疎通確認結果ステータス表示 -->
                                    <div class="connection-status mt-2" :class="connectionClass">
                                        <i :class="connectionIcon"></i>
                                        <span>{{ connectionText }}</span>
                                    </div>
                                </div>

                                <!-- 使用モデル名 (エンジン選択に動的連動) -->
                                <div class="form-field mt-3">
                                    <label class="font-medium">使用モデル名</label>
                                    <InputText 
                                        v-if="selectedEngine === 'gemini'"
                                        v-model="geminiModel" 
                                        placeholder="例: gemini-2.0-flash-exp" 
                                        class="w-full" 
                                    />
                                    
                                    <!-- LM Studio用のモデル選択ドロップダウン (手動入力も可) -->
                                    <Select 
                                        v-else-if="selectedEngine === 'lmstudio' && lmstudioModels.length > 0"
                                        v-model="lmstudioModel" 
                                        :options="lmstudioModels" 
                                        editable
                                        placeholder="モデルを選択または直接入力..." 
                                        class="w-full" 
                                    />
                                    <InputText 
                                        v-else-if="selectedEngine === 'lmstudio'"
                                        v-model="lmstudioModel" 
                                        placeholder="例: Meta-Llama-3-8B-Instruct-GGUF" 
                                        class="w-full" 
                                    />
                                    
                                    <InputText 
                                        v-else-if="selectedEngine === 'openai'"
                                        v-model="openaiModel" 
                                        placeholder="例: gpt-4o" 
                                        class="w-full" 
                                    />
                                    <InputText 
                                        v-else-if="selectedEngine === 'anthropic'"
                                        v-model="anthropicModel" 
                                        placeholder="例: claude-3-5-sonnet-latest" 
                                        class="w-full" 
                                    />
                                </div>

                                <div class="form-field mt-3">
                                    <label class="font-medium flex justify-content-between">
                                        <span>Temperature (創造性): {{ temperature }}</span>
                                    </label>
                                    <Slider v-model="temperature" :min="0" :max="1" :step="0.1" class="mt-2" />
                                </div>
                                <div class="flex justify-content-end mt-4">
                                    <Button 
                                        :label="saveStatus" 
                                        :icon="saveStatus === '保存完了！' ? 'pi pi-check-circle' : 'pi pi-check'" 
                                        class="p-button-primary" 
                                        :disabled="isSaving"
                                        @click="saveSettings" 
                                    />
                                </div>
                            </div>
                        </template>
                    </Card>
                </div>

                <!-- パネル3: 音声AI -->
                <div v-else-if="activeMenu === 'voice'" class="panel-section">
                    <Card class="premium-card">
                        <template #title>音声生成AI設定</template>
                        <template #content>
                            <div class="flex flex-column gap-4">
                                <div class="form-field">
                                    <label class="font-medium">音声エンジン</label>
                                    <Select 
                                        v-model="selectedVoiceEngine" 
                                        :options="voiceEngines" 
                                        optionLabel="name" 
                                        optionValue="value" 
                                        class="w-full" 
                                    />
                                </div>

                                <!-- VOICEVOX 設定エリア (疎通テストと話者・スタイル選択) -->
                                <div v-if="selectedVoiceEngine === 'voicevox'" class="flex flex-column gap-3 mt-3">
                                    <div class="form-field">
                                        <label class="font-medium">VOICEVOX エンドポイント</label>
                                        <div class="flex gap-2 w-full">
                                            <InputText 
                                                v-model="voicevoxEndpoint" 
                                                placeholder="http://localhost:50021" 
                                                class="flex-1"
                                            />
                                            <Button 
                                                icon="pi pi-sync" 
                                                class="p-button-secondary" 
                                                title="疎通確認と話者一覧再読み込み"
                                                :loading="isTestingVoicevox"
                                                @click="testVoicevoxConnection" 
                                            />
                                        </div>
                                    </div>
                                    
                                    <!-- 疎通結果表示 -->
                                    <div class="connection-status mt-2" :class="voicevoxConnectionClass">
                                        <i :class="voicevoxConnectionIcon"></i>
                                        <span>{{ voicevoxConnectionText }}</span>
                                    </div>

                                    <!-- 話者・キャラクタースタイル選択 (ボイスモデル選択) -->
                                    <div class="form-field mt-3">
                                        <label class="font-medium">使用話者スタイル (ボイスモデル)</label>
                                        <Select 
                                            v-if="voicevoxSpeakers.length > 0"
                                            v-model="voicevoxSpeaker" 
                                            :options="voicevoxSpeakers" 
                                            optionLabel="name" 
                                            optionValue="value" 
                                            placeholder="話者スタイルを選択..." 
                                            class="w-full" 
                                        />
                                        <div v-else class="flex gap-2 align-items-center">
                                            <InputText 
                                                v-model.number="voicevoxSpeaker" 
                                                placeholder="話者ID (例: 2)" 
                                                class="w-full"
                                                type="number"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div class="flex justify-content-end mt-4">
                                    <Button 
                                        :label="saveStatus" 
                                        :icon="saveStatus === '保存完了！' ? 'pi pi-check-circle' : 'pi pi-check'" 
                                        class="p-button-primary" 
                                        :disabled="isSaving"
                                        @click="saveSettings" 
                                    />
                                </div>
                            </div>
                        </template>
                    </Card>
                </div>

                <!-- パネル4: 画像AI -->
                <div v-else-if="activeMenu === 'image'" class="panel-section">
                    <Card class="premium-card">
                        <template #title>画像生成AI設定</template>
                        <template #content>
                            <div class="flex flex-column gap-4">
                                <div class="form-field">
                                    <label class="font-medium">画像生成AIエンジン</label>
                                    <Select 
                                        v-model="selectedImageEngine" 
                                        :options="imageEngines" 
                                        optionLabel="name" 
                                        optionValue="value" 
                                        class="w-full" 
                                    />
                                </div>
                                <div class="flex justify-content-end mt-4">
                                    <Button 
                                        :label="saveStatus" 
                                        :icon="saveStatus === '保存完了！' ? 'pi pi-check-circle' : 'pi pi-check'" 
                                        class="p-button-primary" 
                                        :disabled="isSaving"
                                        @click="saveSettings" 
                                    />
                                </div>
                            </div>
                        </template>
                    </Card>
                </div>

                <!-- パネル5: 動画AI -->
                <div v-else-if="activeMenu === 'video'" class="panel-section">
                    <Card class="premium-card">
                        <template #title>動画生成AI設定</template>
                        <template #content>
                            <div class="flex flex-column gap-4">
                                <div class="form-field">
                                    <label class="font-medium">動画生成AIエンジン</label>
                                    <Select 
                                        v-model="selectedVideoEngine" 
                                        :options="videoEngines" 
                                        optionLabel="name" 
                                        optionValue="value" 
                                        class="w-full" 
                                    />
                                </div>
                                <div class="flex justify-content-end mt-4">
                                    <Button 
                                        :label="saveStatus" 
                                        :icon="saveStatus === '保存完了！' ? 'pi pi-check-circle' : 'pi pi-check'" 
                                        class="p-button-primary" 
                                        :disabled="isSaving"
                                        @click="saveSettings" 
                                    />
                                </div>
                            </div>
                        </template>
                    </Card>
                </div>

                <!-- パネル6: APIキー -->
                <div v-else-if="activeMenu === 'apikey'" class="panel-section">
                    <Card class="premium-card">
                        <template #title>API認証情報設定</template>
                        <template #content>
                            <div class="flex flex-column gap-4">
                                <!-- Gemini API Key -->
                                <div v-if="selectedEngine === 'gemini'" class="form-field">
                                    <label class="font-medium">Gemini API KEY</label>
                                    <Password 
                                        v-model="geminiApiKey" 
                                        toggleMask 
                                        :feedback="false" 
                                        class="w-full" 
                                        inputClass="w-full"
                                    />
                                </div>

                                <!-- LM Studio -->
                                <div v-else-if="selectedEngine === 'lmstudio'" class="form-field">
                                    <label class="font-medium">API KEY</label>
                                    <InputText placeholder="LM Studio（ローカル環境）はAPIキー認証が不要です。" class="w-full" disabled />
                                </div>

                                <!-- その他 -->
                                <div v-else class="form-field">
                                    <label class="font-medium">{{ selectedEngine.toUpperCase() }} API KEY (モック)</label>
                                    <InputText placeholder="APIキーを入力..." class="w-full" disabled />
                                </div>

                                <div class="flex justify-content-end mt-4">
                                    <Button 
                                        :label="saveStatus" 
                                        :icon="saveStatus === '保存完了！' ? 'pi pi-check-circle' : 'pi pi-check'" 
                                        class="p-button-primary" 
                                        :disabled="isSaving"
                                        @click="saveSettings" 
                                    />
                                </div>
                            </div>
                        </template>
                    </Card>
                </div>
            </div>
        </main>
    </div>
</template>

<style scoped>
.settings-layout {
    width: 100vw;
    height: 100vh;
    display: flex;
    background: #111111;
    overflow: hidden;
    font-family: 'Outfit', 'Inter', sans-serif;
}

/* --- 左サイドバーのスタイル --- */
.sidebar {
    width: 240px;
    background: #161616;
    border-right: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    padding: 24px 16px;
    box-sizing: border-box;
    cursor: grab;
}

.brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    margin-bottom: 20px;
}

.logo {
    font-size: 28px;
}

.brand-text h2 {
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
}

.brand-text p {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    margin: 2px 0 0 0;
}

.menu {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
}

.menu-item {
    background: transparent;
    border: none;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
}

.menu-item i {
    font-size: 15px;
}

.menu-item:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.03);
}

.menu-item.active {
    color: #a855f7; /* 高貴なパープル */
    background: rgba(168, 85, 247, 0.08);
    font-weight: 600;
}

.sidebar-footer {
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.quit-btn {
    width: 100%;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.15);
    color: #f87171;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.quit-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
    box-shadow: 0 0 12px rgba(239, 68, 68, 0.15);
}

/* --- 右側コンテンツエリアのスタイル --- */
.main-content {
    flex: 1;
    height: 100%;
    overflow-y: auto;
    padding: 32px;
    box-sizing: border-box;
    background: #121212;
}

.content-container {
    max-width: 680px;
    margin: 0 auto;
}

.panel-section {
    animation: fadeIn 0.3s ease;
}

.premium-card {
    background: #161616 !important;
    border: 1px solid rgba(255, 255, 255, 0.03) !important;
    border-radius: 12px !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
}

/* フォームフィールド */
.form-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.form-field label {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.85);
}

/* マスコット一覧 */
.mascot-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.mascot-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.mascot-item:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.08);
}

.mascot-item.active {
    border-color: #a855f7;
    background: rgba(168, 85, 247, 0.06);
}

.mascot-item .avatar {
    font-size: 32px;
}

.mascot-item .info {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.mascot-item .name {
    font-weight: 600;
    font-size: 14px;
    color: #fff;
}

.mascot-item .desc {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
}

/* ユーティリティ */
.flex { display: flex; }
.flex-column { flex-direction: column; }
.gap-4 { gap: 1.5rem; }
.gap-3 { gap: 1rem; }
.gap-2 { gap: 0.5rem; }
.justify-content-between { justify-content: space-between; }
.justify-content-end { justify-content: flex-end; }
.align-items-center { align-items: center; }
.mt-2 { margin-top: 0.5rem; }
.mt-3 { margin-top: 1rem; }
.mt-4 { margin-top: 1.5rem; }
.mb-4 { margin-bottom: 1.5rem; }
.w-full { width: 100%; }

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(4px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* --- 疎通確認ステータス表示のスタイル --- */
.connection-status {
    border-radius: 8px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    transition: all 0.3s ease;
}
.status-idle {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.5);
}
.status-success {
    background: rgba(34, 197, 94, 0.08);
    border: 1px solid rgba(34, 197, 94, 0.2);
    color: #4ade80; /* やさしいグリーン */
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.1);
}
.status-failed {
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #f87171; /* やさしいレッド */
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.1);
}
.flex-1 {
    flex: 1;
}
.text-green-400 {
    color: #4ade80;
}
.text-red-400 {
    color: #f87171;
}
.text-gray-400 {
    color: rgba(255, 255, 255, 0.4);
}
</style>
