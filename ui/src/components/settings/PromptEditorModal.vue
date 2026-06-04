<script setup lang="ts">
import { ref, watch } from 'vue';
import Button from 'primevue/button';

const props = defineProps<{
    visible: boolean;
    mascotId: string;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'save-done'): void;
}>();

const identity = ref('');
const soul = ref('');
const userPrompt = ref('');
const agents = ref('');
const memory = ref('');
const isSaving = ref(false);

const loadPrompts = async () => {
    if (!props.mascotId) return;
    try {
        if (window.electronAPI) {
            const data = await window.electronAPI.getMascotPrompts(props.mascotId);
            identity.value = data.identity || '';
            soul.value = data.soul || '';
            userPrompt.value = data.user || '';
            agents.value = data.agents || '';
            memory.value = data.memory || '';
        }
    } catch (err) {
        console.error('Failed to load mascot prompts in modal:', err);
    }
};

watch(
    () => props.visible,
    (newVal) => {
        if (newVal) {
            loadPrompts();
        }
    },
    { immediate: true }
);

watch(
    () => props.mascotId,
    () => {
        if (props.visible) {
            loadPrompts();
        }
    }
);

const handleSave = async () => {
    if (!props.mascotId) return;
    isSaving.value = true;
    try {
        if (window.electronAPI) {
            const res = await window.electronAPI.saveMascotPrompts(props.mascotId, {
                identity: identity.value,
                soul: soul.value,
                user: userPrompt.value,
                agents: agents.value,
                memory: memory.value
            });
            if (res.success) {
                emit('save-done');
                emit('close');
            } else {
                alert('保存に失敗しました: ' + res.error);
            }
        }
    } catch (err: any) {
        alert('保存エラー: ' + err.message);
    } finally {
        isSaving.value = false;
    }
};
</script>

<template>
    <div v-if="visible" class="custom-modal-overlay prompt-edit-modal-overlay">
        <div class="custom-modal-card prompt-edit-modal-card">
            <div class="modal-header flex justify-content-between align-items-center pb-2 border-bottom border-gray-200">
                <h2 class="text-base font-bold flex align-items-center gap-2 m-0 text-slate-800">
                    <i class="pi pi-user-edit text-purple-500 text-sm"></i>
                    <span>詳細プロンプト設定 (OpenClawフォーマット)</span>
                </h2>
                <Button icon="pi pi-times" class="p-button-rounded p-button-text p-button-secondary" style="width: 28px; height: 28px; padding: 0;" @click="emit('close')" />
            </div>

            <div class="modal-body-container flex flex-column gap-3 mt-3 overflow-y-auto flex-1 pr-1" style="min-height: 0;">
                
                <!-- Identity -->
                <div class="prompt-section p-3 bg-slate-50 border-round border-1 border-gray-200">
                    <div class="flex align-items-center justify-content-between mb-1">
                        <label class="text-sm font-bold text-slate-800">Identity (自己定義 / 役割設定)</label>
                        <span class="text-xxs text-gray-400 font-mono">identity.md</span>
                    </div>
                    <p class="text-xs text-gray-500 m-0 mb-2">
                        マスコットキャラクター自身の名前、年齢、職業、どのような存在（妖精、アンドロイドなど）なのかを設定します。AIが自分が誰であるかを理解するための基礎となる情報です。
                    </p>
                    <textarea 
                        v-model="identity" 
                        placeholder="# Mascot Identity&#10;- 名前: ココ&#10;- 種族: 電子の妖精&#10;- 目的: マスターの作業をサポートすること。" 
                        rows="4" 
                        class="w-full p-2 bg-white border-1 border-gray-300 border-round text-gray-800 text-sm focus:border-purple-400 focus:outline-none font-mono"
                    ></textarea>
                </div>

                <!-- Soul -->
                <div class="prompt-section p-3 bg-slate-50 border-round border-1 border-gray-200">
                    <div class="flex align-items-center justify-content-between mb-1">
                        <label class="text-sm font-bold text-slate-800">Soul (ソウル / 性格・口調設定)</label>
                        <span class="text-xxs text-gray-400 font-mono">soul.md</span>
                    </div>
                    <p class="text-xs text-gray-500 m-0 mb-2">
                        キャラクターの性格（例: 甘えん坊、ツンデレ）、話し方の特徴や口調（一人称、好む語尾「〜だよ」「〜だね」など）、感情表現の傾向を設定します。
                    </p>
                    <textarea 
                        v-model="soul" 
                        placeholder="# Mascot Soul&#10;- 口調: 少し甘えん坊で親しみやすい口調。&#10;- 語尾: 「〜だよ」「〜だね」を多く使う。&#10;- 一人称: 「わたし」" 
                        rows="4" 
                        class="w-full p-2 bg-white border-1 border-gray-300 border-round text-gray-800 text-sm focus:border-purple-400 focus:outline-none font-mono"
                    ></textarea>
                </div>

                <!-- User -->
                <div class="prompt-section p-3 bg-slate-50 border-round border-1 border-gray-200">
                    <div class="flex align-items-center justify-content-between mb-1">
                        <label class="text-sm font-bold text-slate-800">User (ユーザー / 関係性・文脈設定)</label>
                        <span class="text-xxs text-gray-400 font-mono">user.md</span>
                    </div>
                    <p class="text-xs text-gray-500 m-0 mb-2">
                        ユーザー（あなた）とキャラクターとの関係（例: 主主人とメイド、友達同士、先生と生徒）や、キャラクターがユーザーを何と呼ぶか（例: マスター、プロデューサー）を設定します。
                    </p>
                    <textarea 
                        v-model="userPrompt" 
                        placeholder="# User Context&#10;- ユーザーの呼び方: 「マスター」&#10;- 関係性: 常にマスターに懐いており、役に立ちたいと思っている。" 
                        rows="4" 
                        class="w-full p-2 bg-white border-1 border-gray-300 border-round text-gray-800 text-sm focus:border-purple-400 focus:outline-none font-mono"
                    ></textarea>
                </div>

                <!-- Agents -->
                <div class="prompt-section p-3 bg-slate-50 border-round border-1 border-gray-200">
                    <div class="flex align-items-center justify-content-between mb-1">
                        <label class="text-sm font-bold text-slate-800">Agents (行動規範 / ルール・安全基準)</label>
                        <span class="text-xxs text-gray-400 font-mono">agents.md</span>
                    </div>
                    <p class="text-xs text-gray-500 m-0 mb-2">
                        マスコットが行動する際の判断基準、会話上の安全基準（NGワードや避けるべき話題）、および遵守すべきAIとしてのルールを設定します。
                    </p>
                    <textarea 
                        v-model="agents" 
                        placeholder="# Mascot Agents & Rules&#10;- ルール: 暴力的、または公序良俗に反する発言は避ける。&#10;- 判断基準: 常にマスターの味方として肯定的に接すること。" 
                        rows="4" 
                        class="w-full p-2 bg-white border-1 border-gray-300 border-round text-gray-800 text-sm focus:border-purple-400 focus:outline-none font-mono"
                    ></textarea>
                </div>

                <!-- Memory -->
                <div class="prompt-section p-3 bg-slate-50 border-round border-1 border-gray-200">
                    <div class="flex align-items-center justify-content-between mb-1">
                        <label class="text-sm font-bold text-slate-800">Memory (長期記憶 / 合意・約束・設定)</label>
                        <span class="text-xxs text-gray-400 font-mono">memory.md</span>
                    </div>
                    <p class="text-xs text-gray-500 m-0 mb-2">
                        ユーザーとの会話から蓄積された、長期的に覚えておくべき重要な設定やお互いの間の約束事、マスターの好みなどの記録を設定・保管します。
                    </p>
                    <textarea 
                        v-model="memory" 
                        placeholder="# Mascot Long-term Memory&#10;- 合意事項: 毎週土曜日はマスターと一緒にゲームをする約束をした。&#10;- マスターの情報: コーヒーはブラック派。" 
                        rows="4" 
                        class="w-full p-2 bg-white border-1 border-gray-300 border-round text-gray-800 text-sm focus:border-purple-400 focus:outline-none font-mono"
                    ></textarea>
                </div>

            </div>

            <div class="modal-footer flex justify-content-end gap-2 pt-3 border-top border-gray-200 mt-3">
                <Button label="キャンセル" icon="pi pi-times" class="p-button-outlined p-button-secondary p-button-sm" @click="emit('close')" :disabled="isSaving" />
                <Button label="保存する" icon="pi pi-save" class="p-button-primary p-button-sm px-4" @click="handleSave" :loading="isSaving" />
            </div>
        </div>
    </div>
</template>

<style scoped>
.prompt-edit-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(241, 245, 249, 0.8) !important;
    backdrop-filter: blur(12px) !important;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
}

.prompt-edit-modal-card {
    background: #ffffff !important;
    border: 1px solid rgba(0, 0, 0, 0.08) !important;
    width: 90vw !important;
    max-width: 800px !important;
    height: 90vh !important;
    max-height: 750px !important;
    display: flex;
    flex-direction: column;
    color: #1e293b;
    overflow: hidden !important;
    padding: 16px 24px !important;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.border-bottom {
    border-bottom: 1px solid #e2e8f0 !important;
}
.border-top {
    border-top: 1px solid #e2e8f0 !important;
}

.prompt-section textarea {
    resize: vertical;
}

.text-xxs {
    font-size: 10px;
}
</style>
