<script setup lang="ts">
import { ref } from 'vue';
import Card from 'primevue/card';
import Select from 'primevue/select';
import Button from 'primevue/button';
import { useConfigStore } from '@/store/config';
import { storeToRefs } from 'pinia';

const configStore = useConfigStore();
const {
    selectedImageEngine
} = storeToRefs(configStore);

const imageEngines = ref([
    { name: 'DALL-E 3 (OpenAI)', value: 'dalle3' },
    { name: 'Stable Diffusion (ローカル)', value: 'sd_local' },
    { name: 'Midjourney API', value: 'midjourney' }
]);

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
</template>
