<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Card from 'primevue/card';
import Select from 'primevue/select';
import Button from 'primevue/button';
import Slider from 'primevue/slider';
import InputText from 'primevue/inputtext';
import { useConfigStore } from '@/store/config';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';

const configStore = useConfigStore();
const authStore = useAuthStore();

const {
    windowMode,
    mascotScale,
    alwaysOnTop,
    chatOpacity,
    chatAlwaysOnTop,
    chatSendKey,
    chatFontFamily,
    chatBorderShow,
    chatBorderColor,
    chatBorderWidth,
    chatBackgroundColor,
    useServer,
    serverHost,
    serverPort
} = storeToRefs(configStore);

const { user, isAuthenticated } = storeToRefs(authStore);

const mascotAlwaysOnTopOptions = ref([
    { name: '常に最前面に表示する', value: true },
    { name: '最前面に表示しない', value: false }
]);

const chatAlwaysOnTopOptions = ref([
    { name: '常に最前面に表示する', value: true },
    { name: '最前面に表示しない', value: false },
    { name: 'マスコットと連動', value: 'sync' }
]);

const sendKeyOptions = ref([
    { name: 'Enter で送信 (Shift + Enter で改行)', value: 'enter' },
    { name: 'Shift + Enter で送信 (Enter で改行)', value: 'shiftEnter' }
]);

const fontFamilyOptions = ref([
    { name: 'システムデフォルト (sans-serif)', value: 'sans-serif' },
    { name: 'Yu Gothic UI / 游ゴシック', value: '"Yu Gothic UI", "Yu Gothic", sans-serif' },
    { name: 'Meiryo / メイリオ', value: '"Meiryo", sans-serif' },
    { name: 'Segoe UI', value: '"Segoe UI", sans-serif' },
    { name: 'MS PGothic / ＭＳ Ｐゴシック', value: '"MS PGothic", sans-serif' }
]);

const windowModeOptions = ref([
    { name: '分割', desc: 'マスコットとチャットを分離', value: 'split' },
    { name: '統合', desc: 'マスコットとチャットを統合', value: 'integrated' },
    { name: 'コンパクト', desc: 'チャット内にマスコット', value: 'compact' }
]);

const saveStatus = ref('設定を保存');
const isSaving = ref(false);
let initialWindowMode = '';

// --- サーバー接続 疎通確認用の状態変数・関数 ---
const isTestingServerConnection = ref(false);
const serverConnectionState = ref<'idle' | 'success' | 'failed'>('idle');
const serverConnectionErrorMsg = ref('');

const testServerConnection = async () => {
    isTestingServerConnection.value = true;
    serverConnectionState.value = 'idle';
    serverConnectionErrorMsg.value = '';
    
    if (window.electronAPI && window.electronAPI.testServerConnection) {
        try {
            const result = await window.electronAPI.testServerConnection(serverHost.value, serverPort.value);
            if (result.success) {
                serverConnectionState.value = 'success';
            } else {
                serverConnectionState.value = 'failed';
                serverConnectionErrorMsg.value = result.error || '接続に失敗しました。';
            }
        } catch (e: any) {
            serverConnectionState.value = 'failed';
            serverConnectionErrorMsg.value = '通信エラーが発生しました。';
        }
    } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        serverConnectionState.value = 'success';
    }
    isTestingServerConnection.value = false;
};

const serverConnectionClass = computed(() => {
    if (serverConnectionState.value === 'success') return 'status-success';
    if (serverConnectionState.value === 'failed') return 'status-failed';
    return 'status-idle';
});

const serverConnectionIcon = computed(() => {
    if (serverConnectionState.value === 'success') return 'pi pi-check-circle text-green-400';
    if (serverConnectionState.value === 'failed') return 'pi pi-times-circle text-red-400';
    return 'pi pi-info-circle text-gray-400';
});

const serverConnectionText = computed(() => {
    if (serverConnectionState.value === 'success') return '接続成功！サーバーは稼働しています。';
    if (serverConnectionState.value === 'failed') return `接続失敗: ${serverConnectionErrorMsg.value}`;
    return 'ホストとポートを入力して疎通テストを行ってください。';
});

// --- マスコットサイズ調整用ハンドラー ---
const updateMascotScale = () => {
    if (window.electronAPI && window.electronAPI.setMascotScale) {
        window.electronAPI.setMascotScale(mascotScale.value);
    }
};

const changeScalePreset = (scale: number) => {
    mascotScale.value = scale;
    updateMascotScale();
};

const saveSettings = async () => {
    isSaving.value = true;
    saveStatus.value = '保存中...';

    const modeChanged = windowMode.value !== initialWindowMode;

    try {
        await configStore.saveConfig();
        setTimeout(() => {
            saveStatus.value = '保存完了！';
            isSaving.value = false;

            if (modeChanged) {
                if (confirm('ウィンドウモードが変更されました。設定を反映するためにアプリケーションを再起動しますか？')) {
                    relaunchApp();
                } else {
                    initialWindowMode = windowMode.value;
                }
            }

            setTimeout(() => {
                saveStatus.value = '設定を保存';
            }, 2000);
        }, 600);
    } catch (e) {
        saveStatus.value = '保存エラー';
        isSaving.value = false;
    }
};

const relaunchApp = () => {
    if (window.electronAPI && window.electronAPI.relaunchApp) {
        window.electronAPI.relaunchApp();
    }
};

onMounted(async () => {
    initialWindowMode = windowMode.value;
    if (useServer.value) {
        authStore.checkAuthStatus();
    }
});
</script>

<template>
    <Card class="premium-card">
        <template #title>ウィンドウ設定</template>
        <template #content>
            <div class="flex flex-column gap-4">
                <!-- ウィンドウモード設定 -->
                <div class="form-field-header font-bold text-base border-bottom pb-2 mb-2 text-purple-600 flex align-items-center gap-2">
                    <i class="pi pi-th-large text-purple-500"></i>
                    <span>ウィンドウモード設定</span>
                </div>

                <div class="form-field">
                    <label class="font-medium">ウィンドウモード</label>
                    <Select 
                        v-model="windowMode" 
                        :options="windowModeOptions" 
                        optionLabel="name" 
                        optionValue="value" 
                        class="w-full mt-2" 
                    >
                        <template #option="slotProps">
                            <div class="flex align-items-center">
                                <span>{{ slotProps.option.name }} ｜ {{ slotProps.option.desc }}</span>
                            </div>
                        </template>
                    </Select>
                </div>

                <!-- マスコットウィンドウ設定 -->
                <div class="form-field-header font-bold text-base border-bottom pb-2 mb-2 text-purple-600 flex align-items-center gap-2">
                    <i class="pi pi-user text-purple-500"></i>
                    <span>マスコットウィンドウ設定</span>
                </div>

                <div class="form-field">
                    <label class="font-medium flex justify-content-between">
                        <span>表示サイズ (スケール): {{ windowMode === 'compact' ? 50 : Math.round((mascotScale || 1.0) * 100) }}%</span>
                        <span v-if="windowMode === 'compact'" class="text-xs text-yellow-500 font-normal">※コンパクト表示時は50%に固定されます</span>
                    </label>
                    <Slider :modelValue="windowMode === 'compact' ? 0.5 : mascotScale" :disabled="windowMode === 'compact'" :min="0.5" :max="2.0" :step="0.1" class="mt-2" @change="(val: any) => { if (windowMode !== 'compact' && typeof val === 'number') { mascotScale = val; updateMascotScale(); } }" />
                </div>

                <div class="form-field">
                    <label class="font-medium">クイックサイズ変更</label>
                    <div class="flex gap-2 mt-2">
                        <Button :label="windowMode === 'compact' ? '50%' : '50%'" class="p-button-outlined p-button-sm flex-1" :class="{'p-button-primary': (windowMode === 'compact' ? 0.5 : mascotScale) === (windowMode === 'compact' ? 0.5 : 0.5)}" :disabled="windowMode === 'compact'" @click="changeScalePreset(0.5)" />
                        <Button label="75%" class="p-button-outlined p-button-sm flex-1" :class="{'p-button-primary': (windowMode === 'compact' ? null : mascotScale) === 0.75}" :disabled="windowMode === 'compact'" @click="changeScalePreset(0.75)" />
                        <Button label="100% (標準)" class="p-button-outlined p-button-sm flex-1" :class="{'p-button-primary': (windowMode === 'compact' ? null : mascotScale) === 1.0}" :disabled="windowMode === 'compact'" @click="changeScalePreset(1.0)" />
                        <Button label="150%" class="p-button-outlined p-button-sm flex-1" :class="{'p-button-primary': (windowMode === 'compact' ? null : mascotScale) === 1.5}" :disabled="windowMode === 'compact'" @click="changeScalePreset(1.5)" />
                    </div>
                </div>

                <div class="form-field mt-3">
                    <label class="font-medium">最前面表示</label>
                    <Select 
                        v-model="alwaysOnTop" 
                        :options="mascotAlwaysOnTopOptions" 
                        optionLabel="name" 
                        optionValue="value" 
                        class="w-full" 
                    />
                </div>

                <!-- チャットウィンドウ設定 -->
                <div class="form-field-header font-bold text-base border-bottom pb-2 mt-4 mb-2 text-purple-600 flex align-items-center gap-2">
                    <i class="pi pi-comments text-purple-500"></i>
                    <span>チャットウィンドウ設定</span>
                </div>

                <!-- 背景色 & 不透明度の横並び -->
                <div class="flex gap-3 mt-2">
                    <div class="flex-1 form-field">
                        <label class="font-medium flex justify-content-between">
                            <span>メッセージエリア背景色</span>
                        </label>
                        <div class="flex align-items-center gap-2 mt-2">
                            <input type="color" v-model="chatBackgroundColor" class="p-0 border-round cursor-pointer border-1 border-300" style="width: 40px; height: 32px;" />
                            <InputText v-model="chatBackgroundColor" placeholder="#ffffff" class="flex-1" />
                        </div>
                    </div>
                    <div class="flex-1 form-field flex flex-column justify-content-center">
                        <label class="font-medium flex justify-content-between">
                            <span>不透明度 (透明度): {{ Math.round(chatOpacity * 100) }}%</span>
                        </label>
                        <div class="mt-3">
                            <Slider v-model="chatOpacity" :min="0.1" :max="1.0" :step="0.05" />
                        </div>
                    </div>
                </div>

                <!-- 境界線（枠）設定（グループボックス表示） -->
                <fieldset class="border-round p-3 mt-3" style="border: 1px solid rgba(0, 0, 0, 0.12);">
                    <legend class="px-2 text-sm font-semibold text-purple-600">枠</legend>
                    <div class="flex align-items-center gap-3">
                        <div class="flex align-items-center gap-2">
                            <input type="checkbox" id="chatBorderShow" v-model="chatBorderShow" class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
                            <label for="chatBorderShow" class="cursor-pointer text-sm font-medium">表示</label>
                        </div>
                        
                        <div v-if="chatBorderShow" class="flex align-items-center gap-2">
                            <input type="color" v-model="chatBorderColor" class="p-0 border-round cursor-pointer border-1 border-300" style="width: 40px; height: 32px;" />
                            <InputText v-model="chatBorderColor" placeholder="#a855f7" style="width: 100px; height: 32px;" />
                        </div>
                        
                        <div v-if="chatBorderShow" class="flex align-items-center gap-2">
                            <input v-model.number="chatBorderWidth" type="number" min="1" max="10" class="p-inputtext p-component" style="width: 60px; height: 32px;" />
                            <span class="text-sm font-medium">px</span>
                        </div>
                    </div>
                </fieldset>

                <!-- 最前面表示 & 送信キーの横並び -->
                <div class="flex gap-3 mt-3">
                    <div class="flex-1 form-field">
                        <label class="font-medium">最前面表示</label>
                        <Select 
                            v-model="chatAlwaysOnTop" 
                            :options="chatAlwaysOnTopOptions" 
                            optionLabel="name" 
                            optionValue="value" 
                            class="w-full mt-2" 
                        />
                    </div>

                    <div class="flex-1 form-field">
                        <label class="font-medium">送信キー割り当て</label>
                        <Select 
                            v-model="chatSendKey" 
                            :options="sendKeyOptions" 
                            optionLabel="name" 
                            optionValue="value" 
                            class="w-full mt-2" 
                        />
                    </div>
                </div>

                <!-- フォント選択 -->
                <div class="form-field mt-3">
                    <label class="font-medium">チャットウィンドウのフォント</label>
                    <Select 
                        v-model="chatFontFamily" 
                        :options="fontFamilyOptions" 
                        optionLabel="name" 
                        optionValue="value" 
                        editable
                        placeholder="フォント名を選択または直接入力..."
                        class="w-full mt-2" 
                    />
                </div>

                <!-- サーバー連携設定 -->
                <div class="form-field-header font-bold text-base border-bottom pb-2 mt-4 mb-2 text-purple-600 flex align-items-center gap-2">
                    <i class="pi pi-server text-purple-500"></i>
                    <span>サーバー連携設定 (マルチデバイス・軽量化)</span>
                </div>

                <div class="form-field mt-2 flex align-items-center gap-2">
                    <input type="checkbox" id="useServer" v-model="useServer" class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
                    <label for="useServer" class="font-medium cursor-pointer ml-2">外部サーバーと連携する (クライアント＆サーバ構成を有効化)</label>
                </div>

                <div v-if="useServer" class="form-field mt-3 flex flex-column gap-3">
                    <div class="flex gap-3">
                        <div class="flex-1">
                            <label class="font-medium">サーバーホスト (IPアドレス / ドメイン)</label>
                            <InputText v-model="serverHost" placeholder="例: localhost または 192.168.1.10" class="w-full mt-1" />
                        </div>
                        <div style="width: 150px;">
                            <label class="font-medium">ポート番号</label>
                            <input v-model.number="serverPort" type="number" placeholder="例: 3000" class="p-inputtext p-component w-full mt-1" />
                        </div>
                    </div>

                    <div class="flex justify-content-end mt-1">
                        <Button 
                            label="接続テストを実行" 
                            icon="pi pi-sync" 
                            class="p-button-outlined p-button-sm"
                            :loading="isTestingServerConnection"
                            @click="testServerConnection" 
                        />
                    </div>

                    <div class="connection-status mt-1" :class="serverConnectionClass">
                        <i :class="serverConnectionIcon"></i>
                        <span class="ml-2">{{ serverConnectionText }}</span>
                    </div>

                     <!-- ログイン状態・認証UI -->
                     <div class="auth-section mt-3 p-3 border-round bg-gray-50 border-1 border-300">
                         <div class="flex align-items-center justify-content-between">
                             <div class="flex align-items-center gap-2">
                                 <i class="pi pi-user text-purple-500"></i>
                                 <span class="font-bold">ログイン状態:</span>
                                 <span v-if="isAuthenticated" class="text-green-600 font-semibold">{{ user?.email }}</span>
                                 <span v-else class="text-red-500 font-semibold">未ログイン</span>
                             </div>
                             <div>
                                 <Button 
                                     v-if="!isAuthenticated"
                                     label="Googleでログイン" 
                                     icon="pi pi-google" 
                                     class="p-button-sm p-button-success"
                                     @click="authStore.login" 
                                 />
                                 <Button 
                                     v-else
                                     label="ログアウト" 
                                     icon="pi pi-sign-out" 
                                     class="p-button-sm p-button-danger p-button-outlined"
                                     @click="authStore.logout" 
                                 />
                             </div>
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
</template>
