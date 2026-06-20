<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Select from 'primevue/select';
import InputText from 'primevue/inputtext';
import Checkbox from 'primevue/checkbox';
import { useConfigStore } from '@/store/config';
import { storeToRefs } from 'pinia';
import { IrodoriTtsConnector } from '@/connector/irodori-tts-connector';

const configStore = useConfigStore();
const {
    selectedVoiceEngine,
    voicevoxEndpoint,
    voicevoxSpeaker,
    irodoriEndpoint,
    irodoriModel,
    irodoriVoice,
    activeMascot
} = storeToRefs(configStore);

const voiceEngines = ref([
    { name: 'VOICEVOX (ローカル)', value: 'voicevox' },
    { name: 'irodori-tts v3 (ローカル)', value: 'irodori' },
    { name: 'Google Cloud Text-to-Speech', value: 'gtts' }
]);

// VOICEVOX 疎通確認および話者ロード用の状態変数
const isTestingVoicevox = ref(false);
const voicevoxConnectionState = ref<'idle' | 'success' | 'failed'>('idle');
const voicevoxConnectionErrorMsg = ref('');
const voicevoxSpeakers = ref<{ name: string; value: number }[]>([]);

// irodori-tts 疎通確認および話者ロード用の状態変数
const isTestingIrodori = ref(false);
const irodoriConnectionState = ref<'idle' | 'success' | 'failed'>('idle');
const irodoriConnectionErrorMsg = ref('');
const irodoriVoices = ref<{ name: string; value: string }[]>([]);

const saveStatus = ref('設定を保存');
const isSaving = ref(false);

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

// irodori-tts ボイス一覧のロード処理
const fetchIrodoriVoices = async () => {
    isTestingIrodori.value = true;
    irodoriConnectionState.value = 'idle';
    irodoriConnectionErrorMsg.value = '';
    
    try {
        if (window.electronAPI) {
            const result = await window.electronAPI.getIrodoriVoices(irodoriEndpoint.value);
            if (result.success) {
                irodoriConnectionState.value = 'success';
                irodoriVoices.value = result.voices.map(v => ({
                    name: v.id,
                    value: v.id
                }));
                
                // 現在選択されているボイスが一覧に含まれていない場合、最初のボイスをデフォルトに
                if (irodoriVoices.value.length > 0) {
                    const hasVoice = irodoriVoices.value.some(v => v.value === irodoriVoice.value);
                    if (!hasVoice) {
                        irodoriVoice.value = irodoriVoices.value[0].value;
                    }
                }
            } else {
                irodoriConnectionState.value = 'failed';
                irodoriConnectionErrorMsg.value = result.error || 'ボイス一覧の取得に失敗しました。';
                irodoriVoices.value = [];
            }
        } else {
            // ブラウザ開発環境用フォールバック
            const result = await IrodoriTtsConnector.listVoices(irodoriEndpoint.value);
            if (result && result.data) {
                irodoriConnectionState.value = 'success';
                irodoriVoices.value = result.data.map(v => ({
                    name: v.id,
                    value: v.id
                }));
                
                // 現在選択されているボイスが一覧に含まれていない場合、最初のボイスをデフォルトに
                if (irodoriVoices.value.length > 0) {
                    const hasVoice = irodoriVoices.value.some(v => v.value === irodoriVoice.value);
                    if (!hasVoice) {
                        irodoriVoice.value = irodoriVoices.value[0].value;
                    }
                }
            } else {
                irodoriConnectionState.value = 'failed';
                irodoriConnectionErrorMsg.value = 'ボイス一覧の取得に失敗しました。';
                irodoriVoices.value = [];
            }
        }
    } catch (e: any) {
        irodoriConnectionState.value = 'failed';
        irodoriConnectionErrorMsg.value = '通信エラーが発生しました。';
        irodoriVoices.value = [];
    } finally {
        isTestingIrodori.value = false;
    }
};

watch([selectedVoiceEngine, irodoriEndpoint], ([newEngine]) => {
    if (newEngine === 'irodori') {
        fetchIrodoriVoices();
    }
});

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

const irodoriConnectionClass = computed(() => {
    if (irodoriConnectionState.value === 'success') return 'status-success';
    if (irodoriConnectionState.value === 'failed') return 'status-failed';
    return 'status-idle';
});

const irodoriConnectionIcon = computed(() => {
    if (irodoriConnectionState.value === 'success') return 'pi pi-check-circle text-green-400';
    if (irodoriConnectionState.value === 'failed') return 'pi pi-times-circle text-red-400';
    return 'pi pi-info-circle text-gray-400';
});

const irodoriConnectionText = computed(() => {
    if (irodoriConnectionState.value === 'success') return `取得成功 (ボイス数: ${irodoriVoices.value.length})`;
    if (irodoriConnectionState.value === 'failed') return `取得失敗: ${irodoriConnectionErrorMsg.value}`;
    return 'エンドポイントを入力して更新ボタンを押してください。';
});

// --- 音声テスト用 ---
const testMessage = ref('こんにちは！音声合成のテストです。');
const isTestingVoice = ref(false);

const testPlayVoice = async () => {
    if (!testMessage.value.trim()) return;
    isTestingVoice.value = true;
    try {
        let base64Audio: string | null = null;
        const engine = selectedVoiceEngine.value;
        
        if (engine === 'voicevox') {
            if (window.electronAPI) {
                base64Audio = await window.electronAPI.synthesizeVoicevox(
                    testMessage.value,
                    voicevoxSpeaker.value,
                    voicevoxEndpoint.value
                );
            }
        } else if (engine === 'irodori') {
            if (window.electronAPI) {
                base64Audio = await window.electronAPI.synthesizeIrodori(
                    testMessage.value,
                    irodoriEndpoint.value,
                    irodoriModel.value,
                    irodoriVoice.value,
                    'neutral'
                );
            }
        }
        
        if (base64Audio) {
            const mimeType = engine === 'irodori' ? 'audio/mp3' : 'audio/wav';
            const audio = new Audio(`data:${mimeType};base64,${base64Audio}`);
            await audio.play();

            // 音声テスト実行時も保存がONであればローカルに保存する
            if (configStore.saveVoice) {
                const mascotId = configStore.activeMascot?.id || 'default';
                const extension = engine === 'irodori' ? 'mp3' : 'wav';
                if (window.electronAPI) {
                    window.electronAPI.saveMascotVoice(mascotId, base64Audio, extension).catch((err) => {
                        console.error('[Settings] 音声テスト保存エラー:', err);
                    });
                }
            }
        } else {
            console.error('[Settings] 音声合成に失敗しました。');
        }
    } catch (err) {
        console.error('[Settings] 音声テスト再生エラー:', err);
    } finally {
        isTestingVoice.value = false;
    }
};

// 音声ファイル保存用のパス計算およびフォルダオープン処理
const todayDirName = computed(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
});

const savePathDisplay = computed(() => {
    const mascotId = configStore.activeMascot?.id || 'default';
    return `mascots/${mascotId}/voices/${todayDirName.value}`;
});

const openVoiceFolder = () => {
    const relativePath = savePathDisplay.value;
    if (window.electronAPI) {
        window.electronAPI.openFolder(relativePath);
    } else {
        alert('デスクトップ版（Electron）のみ対応している機能です。');
    }
};

const saveSettings = async () => {
    isSaving.value = true;
    saveStatus.value = '保存中...';
    try {
        await configStore.saveConfig();
        setTimeout(() => {
            saveStatus.value = '保存完了！';
            isSaving.value = false;
            setTimeout(() => {
                saveStatus.value = '設定を保存';
            }, 2000);
        }, 600);
    } catch (e) {
        saveStatus.value = '保存エラー';
        isSaving.value = false;
    }
};

onMounted(() => {
    if (selectedVoiceEngine.value === 'voicevox') {
        testVoicevoxConnection();
    }
    if (selectedVoiceEngine.value === 'irodori') {
        fetchIrodoriVoices();
    }
});
</script>

<template>
    <Card class="premium-card">
        <template #title>音声生成AI設定</template>
        <template #content>
            <div class="flex flex-column gap-4">
                <!-- 音声の保存設定 -->
                <div class="form-field border-bottom pb-3 flex flex-column gap-3">
                    <div>
                        <div class="flex align-items-center gap-2 mb-2">
                            <Checkbox v-model="configStore.saveVoice" :binary="true" inputId="save-voice" />
                            <label for="save-voice" class="font-medium cursor-pointer">音声の生成結果をローカルファイルに保存する</label>
                        </div>
                        <div v-if="configStore.saveVoice" class="flex align-items-center gap-2 text-sm text-gray-500 bg-gray-100 dark:bg-gray-800 p-2 border-round">
                            <i class="pi pi-folder"></i>
                            <span>保存先: {{ savePathDisplay }}</span>
                            <Button 
                                icon="pi pi-folder-open" 
                                class="p-button-text p-button-sm p-0 ml-auto" 
                                title="フォルダを開く" 
                                @click="openVoiceFolder"
                            />
                        </div>
                    </div>

                    <div class="flex align-items-center gap-2">
                        <Checkbox v-model="configStore.showVoiceLog" :binary="true" inputId="show-voice-log" />
                        <label for="show-voice-log" class="font-medium cursor-pointer">TTS送信時のデバッグログを出力する</label>
                    </div>
                </div>

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
                    
                    <div class="connection-status mt-2" :class="voicevoxConnectionClass">
                        <i :class="voicevoxConnectionIcon"></i>
                        <span>{{ voicevoxConnectionText }}</span>
                    </div>

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
                        <div v-else class="flex gap-2 align-items-center w-full">
                            <input 
                                v-model.number="voicevoxSpeaker" 
                                placeholder="話者ID (例: 2)" 
                                class="p-inputtext w-full"
                                type="number"
                            />
                        </div>
                    </div>
                </div>

                <div v-if="selectedVoiceEngine === 'irodori'" class="flex flex-column gap-3 mt-3">
                    <div class="form-field">
                        <label class="font-medium">irodori-tts エンドポイント</label>
                        <InputText 
                            v-model="irodoriEndpoint" 
                            placeholder="http://127.0.0.1:8088" 
                            class="w-full"
                        />
                    </div>
                    <div class="form-field">
                        <label class="font-medium">使用モデル (model)</label>
                        <InputText 
                            v-model="irodoriModel" 
                            placeholder="irodori-tts" 
                            class="w-full"
                        />
                    </div>
                    <div class="form-field">
                        <label class="font-medium">使用ボイス/話者 (voice)</label>
                        <div class="flex gap-2 w-full">
                            <Select 
                                v-if="irodoriVoices.length > 0"
                                v-model="irodoriVoice" 
                                :options="irodoriVoices" 
                                optionLabel="name" 
                                optionValue="value" 
                                placeholder="ボイスを選択..." 
                                class="flex-1" 
                            />
                            <InputText 
                                v-else
                                v-model="irodoriVoice" 
                                placeholder="default" 
                                class="flex-1"
                            />
                            <Button 
                                icon="pi pi-sync" 
                                class="p-button-secondary" 
                                title="ボイス一覧再読み込み"
                                :loading="isTestingIrodori"
                                @click="fetchIrodoriVoices" 
                            />
                        </div>
                        <div v-if="irodoriConnectionState !== 'idle'" class="connection-status mt-1" :class="irodoriConnectionClass">
                            <i :class="irodoriConnectionIcon"></i>
                            <span>{{ irodoriConnectionText }}</span>
                        </div>
                    </div>
                </div>

                <div class="form-field mt-3 border-top pt-3">
                    <label class="font-medium">音声テスト</label>
                    <div class="flex gap-2 mt-2">
                        <InputText 
                            v-model="testMessage" 
                            placeholder="テストするテキストを入力..." 
                            class="flex-1"
                        />
                        <Button 
                            label="テスト再生" 
                            icon="pi pi-volume-up" 
                            class="p-button-secondary" 
                            :loading="isTestingVoice"
                            @click="testPlayVoice" 
                        />
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
</template>
