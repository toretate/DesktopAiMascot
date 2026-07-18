<script setup lang="ts">
import { ref } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import { useConfigStore } from '@/store/config';
import { storeToRefs } from 'pinia';

const configStore = useConfigStore();
const {
    toolsGpsLocation,
    toolsWeather,
    toolsVolume,
    toolsAppLauncher,
    toolsWebSearch
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
        <template #title>ツール使用 (Tool Use) 設定</template>
        <template #content>
            <div class="flex flex-column gap-4">
                <p class="text-sm text-gray-500 mb-2">
                    AIが会話中に行える各種機能（ツールの呼び出し）の有効・無効を設定できます。<br />
                    ※ 現在、ツール使用は「LM Studio」エンジンでのみ有効です。
                </p>

                <div class="flex flex-column gap-3">

                    <!-- 2. 位置情報 -->
                    <div class="flex align-items-center gap-2 mt-2">
                        <input 
                            type="checkbox" 
                            id="toolsGpsLocation" 
                            v-model="toolsGpsLocation" 
                            class="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                        />
                        <label for="toolsGpsLocation" class="font-medium cursor-pointer">
                            位置情報の取得 (getGPSLocation)
                        </label>
                    </div>
                    <span class="text-xs text-gray-400 pl-6">
                        マスコットが動作しているPCの現在位置情報をAIが取得できるようにします。
                    </span>

                    <!-- 3. 天気情報 -->
                    <div class="flex align-items-center gap-2 mt-2">
                        <input 
                            type="checkbox" 
                            id="toolsWeather" 
                            v-model="toolsWeather" 
                            class="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                        />
                        <label for="toolsWeather" class="font-medium cursor-pointer">
                            天気情報の取得 (getWeather)
                        </label>
                    </div>
                    <span class="text-xs text-gray-400 pl-6">
                        指定された地域の天気予報をAIが取得できるようにします。
                    </span>

                    <!-- 4. 音量調節 -->
                    <div class="flex align-items-center gap-2 mt-2">
                        <input 
                            type="checkbox" 
                            id="toolsVolume" 
                            v-model="toolsVolume" 
                            class="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                        />
                        <label for="toolsVolume" class="font-medium cursor-pointer">
                            音量調節 (adjustVolume)
                        </label>
                    </div>
                    <span class="text-xs text-gray-400 pl-6">
                        PCのマスター音量をAIが変更できるようにします。
                    </span>

                    <!-- 5. アプリ起動 -->
                    <div class="flex align-items-center gap-2 mt-2">
                        <input 
                            type="checkbox" 
                            id="toolsAppLauncher" 
                            v-model="toolsAppLauncher" 
                            class="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                        />
                        <label for="toolsAppLauncher" class="font-medium cursor-pointer">
                            アプリケーション起動 (launchApp)
                        </label>
                    </div>
                    <span class="text-xs text-gray-400 pl-6">
                        メモ帳や電卓などの指定されたアプリケーションをAIが起動できるようにします。
                    </span>

                    <!-- 6. Web検索 -->
                    <div class="flex align-items-center gap-2 mt-2">
                        <input 
                            type="checkbox" 
                            id="toolsWebSearch" 
                            v-model="toolsWebSearch" 
                            class="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                        />
                        <label for="toolsWebSearch" class="font-medium cursor-pointer">
                            Web検索 (searchWeb)
                        </label>
                    </div>
                    <span class="text-xs text-gray-400 pl-6">
                        インターネット検索を行って、最新の情報をAIが調べられるようにします。
                    </span>
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
