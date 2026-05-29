<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import Card from 'primevue/card';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Select from 'primevue/select';
import Slider from 'primevue/slider';
import InputText from 'primevue/inputtext';

const selectedTab = ref('0');

// AIエンジンのモックデータ
const aiEngines = ref([
    { name: 'Gemini AI Studio', value: 'gemini' },
    { name: 'LM Studio (ローカル)', value: 'lmstudio' },
    { name: 'OpenAI (GPT-4o)', value: 'openai' },
    { name: 'Claude (Anthropic)', value: 'anthropic' }
]);
const selectedEngine = ref('gemini');

// 音声AIエンジンのモックデータ
const voiceEngines = ref([
    { name: 'VOICEVOX (ローカル)', value: 'voicevox' },
    { name: 'Google Cloud Text-to-Speech', value: 'gtts' }
]);
const selectedVoiceEngine = ref('voicevox');

const temperature = ref(0.7);
const geminiApiKey = ref('');
const lmstudioEndpoint = ref('http://127.0.0.1:1234/v1/');
const lmstudioModel = ref('');

const saveStatus = ref('設定を保存');
const isSaving = ref(false);

// 設定データの復元
onMounted(() => {
    geminiApiKey.value = localStorage.getItem('GoogleAiStudioApiKey') || '';
    selectedEngine.value = localStorage.getItem('selectedEngine') || 'gemini';
    selectedVoiceEngine.value = localStorage.getItem('selectedVoiceEngine') || 'voicevox';
    lmstudioEndpoint.value = localStorage.getItem('lmstudioEndpoint') || 'http://127.0.0.1:1234/v1/';
    lmstudioModel.value = localStorage.getItem('lmstudioModel') || '';
    
    const temp = localStorage.getItem('temperature');
    if (temp) {
        temperature.value = parseFloat(temp);
    }
});

// 設定の保存処理
const saveSettings = () => {
    isSaving.value = true;
    saveStatus.value = '保存中...';

    localStorage.setItem('GoogleAiStudioApiKey', geminiApiKey.value);
    localStorage.setItem('selectedEngine', selectedEngine.value);
    localStorage.setItem('selectedVoiceEngine', selectedVoiceEngine.value);
    localStorage.setItem('lmstudioEndpoint', lmstudioEndpoint.value);
    localStorage.setItem('lmstudioModel', lmstudioModel.value);
    localStorage.setItem('temperature', temperature.value.toString());

    setTimeout(() => {
        saveStatus.value = '保存完了！';
        isSaving.value = false;
        setTimeout(() => {
            saveStatus.value = '設定を保存';
        }, 2000);
    }, 600);
};
</script>

<template>
    <div class="settings-container app-dark p-4">
        <header class="settings-header mb-4">
            <h1 class="text-xl font-bold flex align-items-center gap-2">
                <i class="pi pi-cog"></i> Desktop AI Mascot 設定
            </h1>
        </header>

        <Tabs v-model:value="selectedTab">
            <TabList>
                <Tab value="0"><i class="pi pi-user mr-2"></i> マスコット</Tab>
                <Tab value="1"><i class="pi pi-sliders-h mr-2"></i> AI設定</Tab>
                <Tab value="2"><i class="pi pi-key mr-2"></i> APIキー</Tab>
            </TabList>
            <TabPanels class="mt-3">
                <!-- 1. マスコット設定パネル -->
                <TabPanel value="0">
                    <div class="grid-layout">
                        <Card class="mascot-card">
                            <template #title>マスコット一覧</template>
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
                </TabPanel>

                <!-- 2. AI設定パネル -->
                <TabPanel value="1">
                    <Card class="mb-4">
                        <template #title>チャットAIエンジン</template>
                        <template #content>
                            <div class="flex flex-column gap-3">
                                <div class="form-field">
                                    <label class="font-medium">AIエンジン</label>
                                    <Select 
                                        v-model="selectedEngine" 
                                        :options="aiEngines" 
                                        optionLabel="name" 
                                        optionValue="value" 
                                        class="w-full" 
                                    />
                                </div>
                                <div class="form-field mt-2">
                                    <label class="font-medium flex justify-content-between">
                                        <span>Temperature (創造性): {{ temperature }}</span>
                                    </label>
                                    <Slider v-model="temperature" :min="0" :max="1" :step="0.1" class="mt-2" />
                                </div>
                            </div>
                        </template>
                    </Card>

                    <Card>
                        <template #title>音声生成AIエンジン</template>
                        <template #content>
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
                        </template>
                    </Card>
                </TabPanel>

                <!-- 3. APIキー設定パネル -->
                <TabPanel value="2">
                    <Card>
                        <template #title>API認証情報</template>
                        <template #content>
                            <div class="flex flex-column gap-3">
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
                                <div v-else-if="selectedEngine === 'lmstudio'" class="flex flex-column gap-2">
                                    <div class="form-field">
                                        <label class="font-medium">LM Studio エンドポイント</label>
                                        <InputText 
                                            v-model="lmstudioEndpoint" 
                                            placeholder="http://127.0.0.1:1234/v1/" 
                                            class="w-full"
                                        />
                                    </div>
                                    <div class="form-field mt-2">
                                        <label class="font-medium">使用モデル名 (LM Studioでロードしているモデル)</label>
                                        <InputText 
                                            v-model="lmstudioModel" 
                                            placeholder="例: lms-community/Meta-Llama-3-8B-Instruct-GGUF" 
                                            class="w-full"
                                        />
                                    </div>
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
                </TabPanel>
            </TabPanels>
        </Tabs>
    </div>
</template>

<style scoped>
.settings-container {
    width: 100%;
    height: 100vh;
    box-sizing: border-box;
    background: #121212;
    overflow-y: auto;
}

.settings-header h1 {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
    color: rgba(255, 255, 255, 0.9);
}

.form-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

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
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.mascot-item:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
}

.mascot-item.active {
    border-color: #a855f7;
    background: rgba(168, 85, 247, 0.08);
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
    color: rgba(255, 255, 255, 0.6);
}

/* レイアウトユーティリティ */
.flex { display: flex; }
.flex-column { flex-direction: column; }
.gap-3 { gap: 1rem; }
.gap-2 { gap: 0.5rem; }
.justify-content-between { justify-content: space-between; }
.justify-content-end { justify-content: flex-end; }
.align-items-center { align-items: center; }
.mt-2 { margin-top: 0.5rem; }
.mt-3 { margin-top: 1rem; }
.mt-4 { margin-top: 1.5rem; }
.mb-4 { margin-bottom: 1.5rem; }
.mr-2 { margin-right: 0.5rem; }
.w-full { width: 100%; }
</style>
