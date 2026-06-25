<script setup lang="ts">
import { ref } from 'vue';
import Card from 'primevue/card';
import Select from 'primevue/select';
import Button from 'primevue/button';
import { useConfigStore } from '@/store/config';
import { storeToRefs } from 'pinia';

const configStore = useConfigStore();
const {
    selectedImageEngine,
    forgeEndpoint,
    forgeModel,
    forgeLora,
    forgeModelsList,
    forgeLorasList
} = storeToRefs(configStore);

const imageEngines = ref([
    { name: 'DALL-E 3 (OpenAI)', value: 'dalle3' },
    { name: 'Stable Diffusion Forge (ローカル)', value: 'sd_forge' },
    { name: 'Stable Diffusion (ローカル)', value: 'sd_local' },
    { name: 'Midjourney API', value: 'midjourney' }
]);

const saveStatus = ref('設定を保存');
const isSaving = ref(false);

// Forge 用の状態
const connectionStatus = ref('');
const isTestingConnection = ref(false);
const isLoadingModels = ref(false);
const isLoadingLoras = ref(false);

const testConnection = async () => {
    if (!window.electronAPI) return;
    isTestingConnection.value = true;
    connectionStatus.value = '接続確認中...';
    try {
        const ok = await window.electronAPI.forgeTestConnection(forgeEndpoint.value);
        if (ok) {
            connectionStatus.value = '接続成功！';
        } else {
            connectionStatus.value = '接続失敗（起動していない可能性があります）';
        }
    } catch (e: any) {
        connectionStatus.value = `接続エラー: ${e.message}`;
    } finally {
        isTestingConnection.value = false;
    }
};

const loadModels = async () => {
    if (!window.electronAPI) return;
    isLoadingModels.value = true;
    try {
        const models = await window.electronAPI.forgeGetModels(forgeEndpoint.value);
        if (models && models.length > 0) {
            forgeModelsList.value = models;
            await configStore.saveConfig();
            alert(`モデル一覧をロードしました (${models.length} 個)`);
        } else {
            alert('モデル一覧を取得できませんでした。サーバー接続を確認してください。');
        }
    } catch (e: any) {
        alert(`モデル取得エラー: ${e.message}`);
    } finally {
        isLoadingModels.value = false;
    }
};

const loadLoras = async () => {
    if (!window.electronAPI) return;
    isLoadingLoras.value = true;
    try {
        const loras = await window.electronAPI.forgeGetLoras(forgeEndpoint.value);
        if (loras && loras.length > 0) {
            forgeLorasList.value = loras;
            await configStore.saveConfig();
            alert(`LoRA一覧をロードしました (${loras.length} 個)`);
        } else {
            alert('LoRA一覧を取得できませんでした。サーバー接続または設定を確認してください。');
        }
    } catch (e: any) {
        alert(`LoRA取得エラー: ${e.message}`);
    } finally {
        isLoadingLoras.value = false;
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
</script>

<template>
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

                <!-- Stable Diffusion Forge 専用設定 -->
                <div v-if="selectedImageEngine === 'sd_forge'" class="flex flex-column gap-3 p-3 bg-slate-50 border-round border-1 border-gray-200 mt-2">
                    <div class="form-field flex flex-column gap-1">
                        <label class="font-medium text-sm text-slate-700">接続先 URL</label>
                        <div class="flex gap-2">
                            <input 
                                v-model="forgeEndpoint" 
                                type="text" 
                                class="flex-1 p-2 border-round border-1 border-gray-300 text-sm focus:outline-none focus:border-purple-400" 
                                placeholder="http://127.0.0.1:5555"
                            />
                            <Button 
                                :label="isTestingConnection ? '確認中...' : '接続確認'" 
                                icon="pi pi-link" 
                                class="p-button-outlined p-button-secondary p-button-sm" 
                                :disabled="isTestingConnection"
                                @click="testConnection"
                            />
                        </div>
                        <span v-if="connectionStatus" class="text-xs text-slate-500 font-bold mt-1">{{ connectionStatus }}</span>
                    </div>

                    <div class="form-field flex flex-column gap-1">
                        <label class="font-medium text-sm text-slate-700">デフォルトモデル</label>
                        <div class="flex gap-2 align-items-center">
                            <Select 
                                v-model="forgeModel" 
                                :options="forgeModelsList" 
                                editable 
                                class="flex-1 text-sm" 
                                placeholder="sd_model.safetensors など（空欄でデフォルト）"
                            />
                            <Button 
                                :label="isLoadingModels ? 'ロード中...' : 'モデル取得'" 
                                icon="pi pi-refresh" 
                                class="p-button-outlined p-button-info p-button-sm shrink-0" 
                                :disabled="isLoadingModels"
                                @click="loadModels"
                            />
                        </div>
                    </div>

                    <div class="form-field flex flex-column gap-1">
                        <label class="font-medium text-sm text-slate-700">デフォルト LoRA</label>
                        <div class="flex gap-2 align-items-center">
                            <Select 
                                v-model="forgeLora" 
                                :options="forgeLorasList" 
                                editable 
                                class="flex-1 text-sm" 
                                placeholder="LoRA名（空欄でデフォルト）"
                            />
                            <Button 
                                :label="isLoadingLoras ? 'ロード中...' : 'LoRA取得'" 
                                icon="pi pi-refresh" 
                                class="p-button-outlined p-button-info p-button-sm shrink-0" 
                                :disabled="isLoadingLoras"
                                @click="loadLoras"
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
</template>
