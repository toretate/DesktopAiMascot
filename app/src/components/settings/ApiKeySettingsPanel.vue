<script setup lang="ts">
import { ref } from 'vue';
import Card from 'primevue/card';
import Password from 'primevue/password';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { useConfigStore } from '@/store/config';
import { storeToRefs } from 'pinia';

const configStore = useConfigStore();
const {
    googleAiStudioApiKey: geminiApiKey,
    openaiApiKey,
    anthropicApiKey
} = storeToRefs(configStore);

const saveStatus = ref('設定を保存');
const isSaving = ref(false);

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
        <template #title>API認証情報設定</template>
        <template #content>
            <div class="flex flex-column gap-4">
                <div class="form-field">
                    <label class="font-medium">Google AI Studio (Gemini) API KEY</label>
                    <Password 
                        v-model="geminiApiKey" 
                        toggleMask 
                        :feedback="false" 
                        class="w-full" 
                        inputClass="w-full"
                        placeholder="APIキーを入力..."
                    />
                </div>

                <div class="form-field mt-3">
                    <label class="font-medium">OpenAI API KEY</label>
                    <Password 
                        v-model="openaiApiKey" 
                        toggleMask 
                        :feedback="false" 
                        class="w-full" 
                        inputClass="w-full"
                        placeholder="APIキーを入力..."
                    />
                </div>

                <div class="form-field mt-3">
                    <label class="font-medium">Anthropic (Claude) API KEY</label>
                    <Password 
                        v-model="anthropicApiKey" 
                        toggleMask 
                        :feedback="false" 
                        class="w-full" 
                        inputClass="w-full"
                        placeholder="APIキーを入力..."
                    />
                </div>

                <div class="form-field mt-3">
                    <label class="font-medium">LM Studio API KEY</label>
                    <InputText placeholder="LM Studio（ローカル環境）はAPIキー認証が不要です。" class="w-full" disabled />
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
