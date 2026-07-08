<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue';
import { useConfigStore } from '../../../../store/config';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import InputSwitch from 'primevue/inputswitch';

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
    detectMode: 'ai' | 'anime' | 'comfy';
    faceGuide: {
        x: number;
        y: number;
        width: number;
        height: number;
        baseWidth: number;
        baseHeight: number;
    };
    faceCandidates: { faceX: number; faceY: number; faceWidth: number; faceHeight: number }[];
    selectedCandidateIndex: number | null;
}>();

const emit = defineEmits<{
    (e: 'update:detectMode', val: 'ai' | 'anime' | 'comfy'): void;
    (e: 'update:faceGuide', val: typeof props.faceGuide): void;
    (e: 'update:faceCandidates', val: typeof props.faceCandidates): void;
    (e: 'update:selectedCandidateIndex', val: number | null): void;
    (e: 'next'): void;
    (e: 'back'): void;
}>();

const localDetectMode = computed({
    get: () => props.detectMode,
    set: (val) => emit('update:detectMode', val)
});

const localFaceGuide = computed({
    get: () => props.faceGuide,
    set: (val) => emit('update:faceGuide', val)
});

const localFaceCandidates = computed({
    get: () => props.faceCandidates,
    set: (val) => emit('update:faceCandidates', val)
});

const localSelectedCandidateIndex = computed({
    get: () => props.selectedCandidateIndex,
    set: (val) => emit('update:selectedCandidateIndex', val)
});

const isDetectingFace = ref(false);
const showFaceGuide = ref(true);

const originalImageRef = ref<HTMLImageElement | null>(null);
const baseNaturalWidth = ref(1);
const baseNaturalHeight = ref(1);
const displayScale = ref(1.0);

const resolveImageUrl = (path: string | undefined | null): string => {
    if (!path) {
        return '';
    }
    if (path.startsWith('data:image/')) {
        return path;
    }
    let resolved = path;
    if (path.startsWith('/mascots/') && configStore.useServer) {
        resolved = `http://${configStore.serverHost}:${configStore.serverPort}${path}`;
    }
    if (/^[a-zA-Z]:\\/.test(resolved)) {
        return resolved;
    }
    const separator = resolved.includes('?') ? '&' : '?';
    return `${resolved}${separator}v=${configStore.configVersion}`;
};

const baseMascotImageUrl = computed(() => {
    if (props.activePose?.path) return props.activePose.path;
    if (props.activeOutfit?.path) return props.activeOutfit.path;
    if (props.defaultFrontAvatar?.path) return props.defaultFrontAvatar.path;
    return props.editingMascot?.avatar || '';
});

const updateDisplayScale = async () => {
    await nextTick();
    if (originalImageRef.value) {
        const displayedWidth = originalImageRef.value.clientWidth;
        if (displayedWidth > 0 && baseNaturalWidth.value > 0) {
            displayScale.value = displayedWidth / baseNaturalWidth.value;
        }
    }
};

const initFaceGuide = async () => {
    if (!baseMascotImageUrl.value) return;
    isDetectingFace.value = true;
    try {
        if (window.electronAPI?.detectBaseFace) {
            const faceRes = await window.electronAPI.detectBaseFace(baseMascotImageUrl.value, localDetectMode.value);
            if (faceRes && faceRes.success) {
                const newGuide = {
                    x: faceRes.faceX,
                    y: faceRes.faceY,
                    width: faceRes.faceWidth,
                    height: faceRes.faceHeight,
                    baseWidth: faceRes.baseWidth,
                    baseHeight: faceRes.baseHeight
                };
                localFaceGuide.value = newGuide;
                baseNaturalWidth.value = faceRes.baseWidth;
                baseNaturalHeight.value = faceRes.baseHeight;

                if (faceRes.candidates && faceRes.candidates.length > 0) {
                    localFaceCandidates.value = faceRes.candidates;
                    localSelectedCandidateIndex.value = 0;
                } else {
                    localFaceCandidates.value = [];
                    localSelectedCandidateIndex.value = null;
                }

                console.log('[FaceDetect] 顔領域自動検出成功:', newGuide, 'Candidates:', faceRes.candidates);
                await nextTick();
                updateDisplayScale();
            }
        }
    } catch (err) {
        console.error('[FaceDetect] 顔検出中にエラー:', err);
    } finally {
        isDetectingFace.value = false;
    }
};

const goToNextStep = () => {
    emit('next');
};

defineExpose({
    generateAndNext: goToNextStep // 親からの以前の呼び出し（exposeされていた名前）との互換性を保つか、あるいはgoToNextStepをそのまま露出する。今回は親側も修正するのでgoToNextStepにします。
});

const selectCandidate = (index: number) => {
    localSelectedCandidateIndex.value = index;
    const cand = localFaceCandidates.value[index];
    if (cand) {
        localFaceGuide.value = {
            ...localFaceGuide.value,
            x: cand.faceX,
            y: cand.faceY,
            width: cand.faceWidth,
            height: cand.faceHeight
        };
        nextTick(() => {
            updateDisplayScale();
        });
    }
};

// ドラッグ & リサイズ
const isDraggingFaceGuide = ref(false);
const isResizingFaceGuide = ref(false);
let dragStartMouseX = 0;
let dragStartMouseY = 0;
let dragStartFaceX = 0;
let dragStartFaceY = 0;
let dragStartFaceW = 0;
let dragStartFaceH = 0;

const startDragFaceGuide = (event: MouseEvent) => {
    isDraggingFaceGuide.value = true;
    dragStartMouseX = event.clientX;
    dragStartMouseY = event.clientY;
    dragStartFaceX = localFaceGuide.value.x;
    dragStartFaceY = localFaceGuide.value.y;
    
    window.addEventListener('mousemove', dragFaceGuide);
    window.addEventListener('mouseup', stopDragFaceGuide);
};

const dragFaceGuide = (event: MouseEvent) => {
    if (!isDraggingFaceGuide.value) return;
    const dx = (event.clientX - dragStartMouseX) / displayScale.value;
    const dy = (event.clientY - dragStartMouseY) / displayScale.value;
    
    localFaceGuide.value = {
        ...localFaceGuide.value,
        x: Math.round(dragStartFaceX + dx),
        y: Math.round(dragStartFaceY + dy)
    };
};

const stopDragFaceGuide = () => {
    isDraggingFaceGuide.value = false;
    window.removeEventListener('mousemove', dragFaceGuide);
    window.removeEventListener('mouseup', stopDragFaceGuide);
};

const startResizeFaceGuide = (event: MouseEvent) => {
    isResizingFaceGuide.value = true;
    dragStartMouseX = event.clientX;
    dragStartMouseY = event.clientY;
    dragStartFaceW = localFaceGuide.value.width;
    dragStartFaceH = localFaceGuide.value.height;
    
    window.addEventListener('mousemove', resizeFaceGuide);
    window.addEventListener('mouseup', stopResizeFaceGuide);
};

const resizeFaceGuide = (event: MouseEvent) => {
    if (!isResizingFaceGuide.value) return;
    const dx = (event.clientX - dragStartMouseX) / displayScale.value;
    const dy = (event.clientY - dragStartMouseY) / displayScale.value;
    
    const change = Math.max(dx * 2, dy * 2);
    localFaceGuide.value = {
        ...localFaceGuide.value,
        width: Math.max(50, Math.round(dragStartFaceW + change)),
        height: Math.max(50, Math.round(dragStartFaceH + change))
    };
};

const stopResizeFaceGuide = () => {
    isResizingFaceGuide.value = false;
    window.removeEventListener('mousemove', resizeFaceGuide);
    window.removeEventListener('mouseup', stopResizeFaceGuide);
};

const onImageLoad = (event: Event) => {
    const img = event.target as HTMLImageElement;
    baseNaturalWidth.value = img.naturalWidth;
    baseNaturalHeight.value = img.naturalHeight;
    updateDisplayScale();
};

onMounted(() => {
    initFaceGuide();
});
</script>

<template>
    <div class="flex-1 flex flex-row">
        <!-- 左側プレビュー -->
        <div class="flex-1 bg-slate-100 p-6 flex items-center justify-center min-h-[400px] overflow-auto relative">
            <!-- 顔検出ローディング表示 -->
            <div v-if="isDetectingFace" class="absolute inset-0 bg-white/60 backdrop-blur-xs flex flex-col items-center justify-center z-10 select-none">
                <i class="pi pi-spin pi-spinner text-3xl text-primary-500 mb-2"></i>
                <span class="text-sm font-medium text-slate-600">顔領域を自動検出中...</span>
            </div>

            <div class="relative max-w-full max-h-[600px] border border-slate-300 rounded shadow-md overflow-hidden bg-white">
                <img 
                    ref="originalImageRef"
                    v-if="baseMascotImageUrl"
                    :src="resolveImageUrl(baseMascotImageUrl)"
                    alt="オリジナルベース画像"
                    class="max-h-[500px] w-auto block"
                    @load="onImageLoad"
                />

                <!-- 顔領域ガイド枠オーバーレイ -->
                <div 
                    v-if="showFaceGuide" 
                    class="absolute border-2 border-dashed border-sky-400 bg-sky-200/10 cursor-move flex items-center justify-center select-none"
                    :style="{
                        width: `${faceGuide.width * displayScale}px`,
                        height: `${faceGuide.height * displayScale}px`,
                        left: `${(faceGuide.x - faceGuide.width / 2.0) * displayScale}px`,
                        top: `${(faceGuide.y - faceGuide.height / 2.0) * displayScale}px`,
                    }"
                    title="ドラッグで顔の位置を合わせます"
                    @mousedown.prevent="startDragFaceGuide"
                >
                    <!-- 中心十字線 -->
                    <div class="absolute w-4 h-4 flex items-center justify-center pointer-events-none">
                        <div class="absolute w-full h-[2px] bg-sky-500"></div>
                        <div class="absolute h-full w-[2px] bg-sky-500"></div>
                    </div>
                    <!-- 拡縮ハンドル (右下) -->
                    <div 
                        class="absolute right-0 bottom-0 w-3 h-3 bg-sky-500 cursor-se-resize border border-white"
                        title="ドラッグで顔のサイズを合わせます"
                        @mousedown.stop.prevent="startResizeFaceGuide"
                    ></div>
                </div>

                <!-- 非アクティブな顔検出候補枠オーバーレイ -->
                <div 
                    v-if="showFaceGuide"
                    v-for="(cand, idx) in faceCandidates"
                    :key="`cand-${idx}`"
                    v-show="selectedCandidateIndex !== idx"
                    class="absolute border border-dashed border-amber-400 bg-amber-100/5 cursor-pointer flex items-center justify-center select-none hover:bg-amber-100/25 transition-all duration-150 rounded"
                    :style="{
                        width: `${cand.faceWidth * displayScale}px`,
                        height: `${cand.faceHeight * displayScale}px`,
                        left: `${(cand.faceX - cand.faceWidth / 2.0) * displayScale}px`,
                        top: `${(cand.faceY - cand.faceHeight / 2.0) * displayScale}px`,
                        zIndex: 5
                    }"
                    title="クリックしてこの顔検出候補を選択します"
                    @click.stop="selectCandidate(idx)"
                >
                    <span class="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 pointer-events-none shadow-xs">候補 {{ idx + 1 }}</span>
                </div>
            </div>
        </div>

        <!-- 右側設定パネル -->
        <div class="w-80 border-l border-slate-200 p-6 flex flex-col justify-between bg-white overflow-y-auto">
            <div>
                <h2 class="text-lg font-semibold text-slate-900 mb-4">ベース顔領域の確認・調整</h2>
                <p class="text-sm text-slate-600 mb-4">
                    青い点線枠がキャラクターの顔（輪郭と大きさ）にぴったり合うようにドラッグで移動・リサイズして微調整してください。
                </p>
                <p class="text-sm text-slate-600 mb-4">
                    この調整結果が、目・口を消した「ベース画像」の自動生成や、ステップ3での表情パーツ位置合わせの正確な基準位置として使用されます。
                </p>

                <!-- 顔領域の検出方式 -->
                <div class="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">顔の検出方式</span>
                    <Dropdown 
                        v-model="localDetectMode" 
                        :options="[
                            { label: '汎用AIモデル (MediaPipe)', value: 'ai' },
                            { label: '二次元特化モデル (AnimeFace)', value: 'anime' },
                            { label: '画像生成AI顔検出 (ComfyUI)', value: 'comfy' }
                        ]" 
                        optionLabel="label" 
                        optionValue="value" 
                        class="w-full text-sm"
                        @change="initFaceGuide"
                    />
                </div>

                <!-- 顔領域ガイドトグル -->
                <div class="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-medium text-slate-700 font-semibold text-slate-500 uppercase tracking-wider">顔領域のガイド枠</span>
                        <InputSwitch v-model="showFaceGuide" />
                    </div>
                </div>

                <!-- 検出候補リスト（複数候補時） -->
                <div v-if="faceCandidates.length > 1" class="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                    <span class="text-xs font-semibold text-amber-800 uppercase tracking-wider block">顔の検出候補 ({{ faceCandidates.length }}件)</span>
                    <div class="flex flex-col space-y-2">
                        <button 
                            v-for="(cand, idx) in faceCandidates" 
                            :key="`btn-cand-${idx}`"
                            class="text-left text-xs px-3 py-2 rounded-lg border transition-all duration-150 flex items-center justify-between shadow-xs"
                            :class="selectedCandidateIndex === idx ? 'bg-amber-500 border-amber-600 text-white font-semibold' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'"
                            @click="selectCandidate(idx)"
                        >
                            <span>候補 {{ idx + 1 }} (Y: {{ Math.round(cand.faceY) }}px)</span>
                            <i v-if="selectedCandidateIndex === idx" class="pi pi-check-circle text-xs"></i>
                        </button>
                    </div>
                    <span class="text-[10px] text-slate-500 leading-normal block">※誤検出（胸のマークなど）が発生した場合は、画像上の枠または上記リストから正しい候補を選択してください。</span>
                </div>
            </div>
            
            <div class="pt-6 border-t border-slate-100 flex flex-col space-y-2">
                <Button severity="secondary" class="w-full py-2 font-medium text-sm border-slate-300" label="顔の自動検出を再実行" icon="pi pi-refresh" @click="initFaceGuide" :loading="isDetectingFace" />
                <Button severity="primary" class="w-full py-2.5 font-medium text-sm" label="顔位置を確定して次へ" icon="pi pi-check" iconPos="right" @click="goToNextStep" />
            </div>
        </div>
    </div>
</template>
