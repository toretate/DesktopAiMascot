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
            engine: string;
            speaker_id: number;
            style: string;
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
        <div class="form-field flex flex-column gap-1">
            <label class="text-xs font-semibold text-gray-700">アバター (絵文字または画像URL)</label>
            <InputText 
                v-model="props.editingMascot.avatar" 
                placeholder="例: 🤖" 
                class="w-full p-inputtext-sm" 
                @change="emit('change')"
            />
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
