<script setup lang="ts">
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';

interface MascotAsset {
    id: string;
    name: string;
    path: string;
    originalPath?: string;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
    rotation?: number;
    expressions?: MascotAsset[];
}

interface MascotData {
    id: string;
    name: string;
    avatar: string;
    profile: string;
    currentOutfitId?: string;
    currentPoseId?: string;
    defaultExpressionId?: string;
    aiConfig: {
        chat: {
            engine: string;
            model: string;
            temperature: number;
        };
        voice: {
            engine?: string;
            speaker_id?: number;
            style?: string;
            irodori_voice?: string;
            irodori_model?: string;
        };
    };
    assets: {
        outfits: MascotAsset[];
        expressions: MascotAsset[];
        poses: MascotAsset[];
    };
}

const props = defineProps<{
    editingMascot: MascotData;
    mascotPrompts: {
        identity: string;
        soul: string;
        user: string;
        agents: string;
        memory: string;
    };
}>();

const emit = defineEmits<{
    (e: 'change'): void;
    (e: 'open-prompt-modal'): void;
}>();

const getVoiceEngineName = (engine?: string) => {
    if (!engine) return '未設定 (グローバル設定を使用)';
    if (engine === 'voicevox') return 'VOICEVOX (ローカル)';
    if (engine === 'irodori') return 'irodori-tts (ローカル)';
    if (engine === 'gtts') return 'Google Cloud TTS';
    return engine;
};
</script>

<template>
    <div class="flex flex-column gap-3">
        <div class="form-field flex flex-column gap-1">
            <label class="text-xs font-semibold text-gray-700">マスコット名</label>
            <InputText 
                v-model="props.editingMascot.name" 
                placeholder="例: デフォルトロボット" 
                class="w-full p-inputtext-sm" 
                @change="emit('change')"
            />
        </div>

        <!-- 音声設定の表示セクション -->
        <div class="border-top border-gray-200 pt-3 mt-1 flex flex-column gap-2">
            <label class="text-xs font-bold text-gray-700 flex align-items-center gap-1 select-none">
                <i class="pi pi-volume-up text-purple-500"></i>
                <span>音声（ボイス）設定</span>
            </label>
            <div class="bg-gray-50 dark:bg-gray-800 p-2.5 border-round border-1 border-gray-150 flex flex-column gap-2 text-xs text-gray-600 dark:text-gray-300">
                <div class="flex justify-content-between align-items-center">
                    <span class="font-medium text-gray-500">音声エンジン:</span>
                    <span class="font-bold text-purple-600 dark:text-purple-400">
                        {{ getVoiceEngineName(props.editingMascot.aiConfig?.voice?.engine) }}
                    </span>
                </div>
                
                <template v-if="props.editingMascot.aiConfig?.voice?.engine === 'voicevox'">
                    <div class="flex justify-content-between align-items-center border-top border-gray-100 dark:border-gray-700 pt-1.5">
                        <span class="font-medium text-gray-500">話者ID:</span>
                        <span class="font-semibold">{{ props.editingMascot.aiConfig.voice.speaker_id }}</span>
                    </div>
                </template>
                
                <template v-else-if="props.editingMascot.aiConfig?.voice?.engine === 'irodori'">
                    <div class="flex justify-content-between align-items-center border-top border-gray-100 dark:border-gray-700 pt-1.5">
                        <span class="font-medium text-gray-500">使用モデル (model):</span>
                        <span class="font-semibold">{{ props.editingMascot.aiConfig.voice.irodori_model || '未設定 (グローバルモデルを使用)' }}</span>
                    </div>
                    <div class="flex justify-content-between align-items-center border-top border-gray-100 dark:border-gray-700 pt-1.5">
                        <span class="font-medium text-gray-500">使用ボイス (voice):</span>
                        <span class="font-semibold">{{ props.editingMascot.aiConfig.voice.irodori_voice || '未設定 (グローバルボイスを使用)' }}</span>
                    </div>
                </template>
                
                <div v-if="!props.editingMascot.aiConfig?.voice?.engine" class="text-gray-400 italic text-center py-1">
                    個別音声は設定されていません。「音声生成AI設定」からこのマスコットにボイス設定を反映できます。
                </div>
            </div>
        </div>


        <!-- 詳細プロンプト表示エリア (readonly) -->
        <div class="border-top border-gray-200 pt-3 mt-1 flex flex-column gap-2">
            <div class="flex justify-content-between align-items-center">
                <label class="text-xs font-bold text-gray-700 flex align-items-center gap-1 select-none">
                    <i class="pi pi-file text-purple-500"></i>
                    <span>詳細プロンプト設定 (外部ファイル)</span>
                </label>
                <Button 
                    label="詳細プロンプトを編集する" 
                    icon="pi pi-user-edit" 
                    class="p-button-sm p-button-outlined p-button-primary py-1 px-2 text-xs"
                    @click="emit('open-prompt-modal')"
                />
            </div>

            <div class="flex flex-column gap-2 mt-1">
                <!-- Identity -->
                <div class="flex flex-column gap-1">
                    <span class="text-xxs font-bold text-gray-500 select-none">Identity.md (役割設定)</span>
                    <textarea 
                        :value="mascotPrompts.identity" 
                        readonly 
                        rows="2"
                        class="w-full p-2 bg-gray-100 border-1 border-gray-200 border-round text-gray-500 text-xs font-mono"
                        style="resize: none;"
                    ></textarea>
                </div>
                <!-- Soul -->
                <div class="flex flex-column gap-1">
                    <span class="text-xxs font-bold text-gray-500 select-none">Soul.md (性格・口調)</span>
                    <textarea 
                        :value="mascotPrompts.soul" 
                        readonly 
                        rows="2"
                        class="w-full p-2 bg-gray-100 border-1 border-gray-200 border-round text-gray-500 text-xs font-mono"
                        style="resize: none;"
                    ></textarea>
                </div>
                <!-- User -->
                <div class="flex flex-column gap-1">
                    <span class="text-xxs font-bold text-gray-500 select-none">User.md (関係性)</span>
                    <textarea 
                        :value="mascotPrompts.user" 
                        readonly 
                        rows="2"
                        class="w-full p-2 bg-gray-100 border-1 border-gray-200 border-round text-gray-500 text-xs font-mono"
                        style="resize: none;"
                    ></textarea>
                </div>
                <!-- Agents -->
                <div class="flex flex-column gap-1">
                    <span class="text-xxs font-bold text-gray-500 select-none">Agents.md (行動規範)</span>
                    <textarea 
                        :value="mascotPrompts.agents" 
                        readonly 
                        rows="2"
                        class="w-full p-2 bg-gray-100 border-1 border-gray-200 border-round text-gray-500 text-xs font-mono"
                        style="resize: none;"
                    ></textarea>
                </div>
                <!-- Memory -->
                <div class="flex flex-column gap-1">
                    <span class="text-xxs font-bold text-gray-500 select-none">Memory.md (長期記憶)</span>
                    <textarea 
                        :value="mascotPrompts.memory" 
                        readonly 
                        rows="2"
                        class="w-full p-2 bg-gray-100 border-1 border-gray-200 border-round text-gray-500 text-xs font-mono"
                        style="resize: none;"
                    ></textarea>
                </div>
            </div>
        </div>
    </div>
</template>
