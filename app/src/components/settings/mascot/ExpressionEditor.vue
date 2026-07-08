<script setup lang="ts">
import { ref, watch } from 'vue';
import { useConfigStore } from '../../../store/config';
import Button from 'primevue/button';
import Step1FaceGuide from './expression-editor/Step1FaceGuide.vue';
import Step2NofaceEditor from './expression-editor/Step2NofaceEditor.vue';
import Step3ExpressionAligner from './expression-editor/Step3ExpressionAligner.vue';

const configStore = useConfigStore();

interface MascotAsset {
    id: string;
    name: string;
    path: string;
    originalPath?: string;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
    rotation?: number;
}

interface MascotData {
    id: string;
    name: string;
    avatar: string;
    assets: {
        expressions: MascotAsset[];
    };
}

const props = defineProps<{
    editingMascot: MascotData;
    activeOutfit: MascotAsset | null;
    activePose: MascotAsset | null;
    defaultFrontAvatar: MascotAsset | null;
    geminiApiKey?: string;
    initialStep?: number;
    initialExpressionId?: string;
}>();

const emit = defineEmits<{
    (e: 'back-to-settings'): void;
}>();

// ウィザードのステップ状態 (1: ベース顔確認, 2: 位置調整, 3: アニメ確認)
const currentStep = ref(props.initialStep || 1);

watch(() => props.initialStep, (newVal) => {
    if (newVal !== undefined) {
        currentStep.value = newVal;
    }
});

// 各ステップへの参照
const step1Ref = ref<InstanceType<typeof Step1FaceGuide> | null>(null);
const step2Ref = ref<InstanceType<typeof Step2NofaceEditor> | null>(null);

// ステップ間で共有する状態
const nofaceImagePath = ref<string | null>(null);
const originalImagePath = ref<string | null>(null);
const nofaceCacheQuery = ref(0);

const generateEngine = ref<'mediapipe' | 'gemini' | 'comfy'>('mediapipe');
const detectMode = ref<'ai' | 'anime' | 'comfy'>('ai');

const defaultPrompts = {
    gemini: '目、眉、口、鼻を完全に消去し、周囲の肌色と滑らかに馴染ませた Faceless の顔にしてください。髪や輪郭、服、ポーズ、背景などは一切変更せず、完全に元のままとし、顔のパーツ（目・眉・口・鼻）の領域だけを周囲の肌色で自然に埋めてください。最終的な画像のみを出力してください。',
    comfy: 'Remove eyes, eyebrows, mouth, and nose from the face, making the face completely blank/faceless. Keep all other parts like hair, clothes, and outline exactly the same.'
};

const nofacePrompt = ref(defaultPrompts.gemini);

const faceGuide = ref({
    x: 768,       // 物理ピクセルの中央X
    y: 500,       // 物理ピクセルの顔がありそうな高さY
    width: 250,   // 顔幅
    height: 250,  // 顔高さ
    baseWidth: 1536,
    baseHeight: 1920
});

const faceCandidates = ref<{ faceX: number; faceY: number; faceWidth: number; faceHeight: number }[]>([]);
const selectedCandidateIndex = ref<number | null>(null);

// Step 1からStep 2へ遷移するときの初期化処理（元の画像パスの設定など）
const goToStep2 = () => {
    // 立ち絵画像の決定
    let originalPath = '';
    if (props.activePose?.path) originalPath = props.activePose.path;
    else if (props.activeOutfit?.path) originalPath = props.activeOutfit.path;
    else if (props.defaultFrontAvatar?.path) originalPath = props.defaultFrontAvatar.path;
    else originalPath = props.editingMascot?.avatar || '';

    originalImagePath.value = originalPath;
    // nofaceImagePath は最初は生成されていないので null
    nofaceImagePath.value = null;
    nofaceCacheQuery.value = Date.now();
    currentStep.value = 2;
};

const onSaveCompleted = () => {
    emit('back-to-settings');
};

const handleBack = () => {
    emit('back-to-settings');
};

const handleNext = async () => {
    if (currentStep.value === 1) {
        goToStep2();
    } else if (currentStep.value === 2) {
        if (step2Ref.value) {
            // 手動レタッチを保存して設定に戻る
            await step2Ref.value.saveEditedNoface();
        }
    } else if (currentStep.value === 3) {
        emit('back-to-settings');
    }
};
</script>

<template>
    <div class="expression-editor-page p-6 bg-slate-50 min-h-screen text-slate-800 flex flex-col">
        <!-- ヘッダーおよびステップバー -->
        <header class="mb-6 flex flex-col md:flex-row md:items-center md:justify-between border-b pb-4 border-slate-200">
            <div>
                <h1 class="text-2xl font-bold tracking-tight text-slate-900">表情作成 & 位置調整</h1>
                <p class="text-sm text-slate-500">マスコットの表情差分やベース顔領域を個別に調整します。</p>
            </div>
            
            <!-- 現在のステップ表示 -->
            <div class="mt-4 md:mt-0 flex items-center space-x-2 text-sm font-medium animate-fade-in">
                <span v-if="currentStep === 1" class="px-3 py-1.5 rounded-full border bg-primary-500 text-white border-primary-500">1. 顔領域調整</span>
                <span v-if="currentStep === 2" class="px-3 py-1.5 rounded-full border bg-primary-500 text-white border-primary-500">2. ベース顔生成（手動修正）</span>
                <span v-if="currentStep === 3" class="px-3 py-1.5 rounded-full border bg-primary-500 text-white border-primary-500">3. 表情位置調整</span>
            </div>
        </header>

        <!-- メイン領域 -->
        <main class="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-row">
            <!-- STEP 1 -->
            <Step1FaceGuide
                v-if="currentStep === 1"
                ref="step1Ref"
                :editing-mascot="editingMascot"
                :active-outfit="activeOutfit"
                :active-pose="activePose"
                :default-front-avatar="defaultFrontAvatar"
                v-model:detect-mode="detectMode"
                v-model:face-guide="faceGuide"
                v-model:face-candidates="faceCandidates"
                v-model:selected-candidate-index="selectedCandidateIndex"
                @next="goToStep2"
                @back="handleBack"
            />

            <!-- STEP 2 -->
            <Step2NofaceEditor
                v-if="currentStep === 2"
                ref="step2Ref"
                :editing-mascot="editingMascot"
                :active-outfit="activeOutfit"
                :active-pose="activePose"
                :default-front-avatar="defaultFrontAvatar"
                :gemini-api-key="geminiApiKey"
                v-model:noface-image-path="nofaceImagePath"
                v-model:original-image-path="originalImagePath"
                v-model:noface-cache-query="nofaceCacheQuery"
                v-model:generate-engine="generateEngine"
                v-model:noface-prompt="nofacePrompt"
                v-model:detect-mode="detectMode"
                :face-guide="faceGuide"
                @save-completed="onSaveCompleted"
                @back="handleBack"
            />

            <!-- STEP 3 -->
            <Step3ExpressionAligner
                v-if="currentStep === 3"
                :editing-mascot="editingMascot"
                :active-outfit="activeOutfit"
                :active-pose="activePose"
                :default-front-avatar="defaultFrontAvatar"
                :noface-image-path="nofaceImagePath"
                :original-image-path="originalImagePath"
                :noface-cache-query="nofaceCacheQuery"
                :face-guide="faceGuide"
                :detect-mode="detectMode"
                :initial-expression-id="initialExpressionId"
                @back="handleBack"
                @complete="emit('back-to-settings')"
            />
        </main>

        <!-- 下部ナビゲーション -->
        <footer class="mt-6 flex justify-between">
            <Button severity="secondary" class="px-6 py-2.5 font-medium border-slate-300" @click="handleBack" label="設定に戻る" />
            <Button 
                v-if="currentStep === 1" 
                severity="primary" 
                class="px-6 py-2.5 font-medium" 
                @click="handleNext" 
                label="次へ進む" 
            />
            <Button 
                v-else-if="currentStep === 2" 
                severity="primary" 
                class="px-6 py-2.5 font-medium" 
                @click="handleNext" 
                label="ベース顔を保存して完了" 
            />
            <Button 
                v-else-if="currentStep === 3" 
                severity="primary" 
                class="px-6 py-2.5 font-medium" 
                @click="handleNext" 
                label="位置調整完了して戻る" 
            />
        </footer>
    </div>
</template>

<style scoped>
.expression-editor-page {
    /* ページのフル画面スタイルの微調整用 */
}
</style>
