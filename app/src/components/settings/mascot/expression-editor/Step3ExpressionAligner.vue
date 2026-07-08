<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { useConfigStore } from '../../../../store/config';
import Button from 'primevue/button';
import Slider from 'primevue/slider';

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
    nofaceImagePath: string | null;
    originalImagePath: string | null;
    nofaceCacheQuery: number;
    faceGuide: {
        x: number;
        y: number;
        width: number;
        height: number;
        baseWidth: number;
        baseHeight: number;
    };
    detectMode: 'ai' | 'anime' | 'comfy';
    initialExpressionId?: string;
}>();

const emit = defineEmits<{
    (e: 'back'): void;
    (e: 'complete'): void;
}>();

const baseMascotImageUrl = computed(() => {
    if (props.activePose?.path) return props.activePose.path;
    if (props.activeOutfit?.path) return props.activeOutfit.path;
    if (props.defaultFrontAvatar?.path) return props.defaultFrontAvatar.path;
    return props.editingMascot?.avatar || '';
});

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

const currentExpressions = computed(() => {
    return props.activeOutfit?.expressions || props.editingMascot.assets?.expressions || [];
});

const selectedExpression = ref<MascotAsset | null>(null);
const baseOpacity = ref(0.5);
const exprOpacity = ref(1.0);
const extractionMode = ref<'xor' | 'comfy'>('xor');
const isCompareModalVisible = ref(false);
const comfyDetectionData = ref<any | null>(null);
const debugCanvasRef = ref<HTMLCanvasElement | null>(null);

const isExtractingSingle = ref(false);
const isAligning = ref(false);

const baseImageRef = ref<HTMLImageElement | null>(null);
const baseNaturalWidth = ref(1);
const baseNaturalHeight = ref(1);
const exprNaturalWidth = ref(414);
const exprNaturalHeight = ref(444);
const displayScale = ref(1.0);

const updateDisplayScale = async () => {
    await nextTick();
    if (baseImageRef.value) {
        const displayedWidth = baseImageRef.value.clientWidth;
        if (displayedWidth > 0 && baseNaturalWidth.value > 0) {
            displayScale.value = displayedWidth / baseNaturalWidth.value;
            console.log(`[DisplayScale] Step3, displayedWidth=${displayedWidth}, naturalWidth=${baseNaturalWidth.value}, scale=${displayScale.value}`);
        }
    }
};

const onBaseImageLoad = (event: Event) => {
    const img = event.target as HTMLImageElement;
    baseNaturalWidth.value = img.naturalWidth;
    baseNaturalHeight.value = img.naturalHeight;
    updateDisplayScale();
};

const onExprImageLoad = (event: Event) => {
    const img = event.target as HTMLImageElement;
    exprNaturalWidth.value = img.naturalWidth;
    exprNaturalHeight.value = img.naturalHeight;
    updateDisplayScale();
};

const handleKeyDown = (event: KeyboardEvent) => {
    if (!selectedExpression.value) return;
    
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
        return;
    }

    let handled = false;
    
    if (event.key === 'ArrowUp') {
        if (event.shiftKey) {
            selectedExpression.value.scale = Math.min(2.5, Number(((selectedExpression.value.scale || 1.0) + 0.01).toFixed(2)));
        } else {
            selectedExpression.value.offsetY = (selectedExpression.value.offsetY || 0) - 1;
        }
        handled = true;
    } else if (event.key === 'ArrowDown') {
        if (event.shiftKey) {
            selectedExpression.value.scale = Math.max(0.3, Number(((selectedExpression.value.scale || 1.0) - 0.01).toFixed(2)));
        } else {
            selectedExpression.value.offsetY = (selectedExpression.value.offsetY || 0) + 1;
        }
        handled = true;
    } else if (event.key === 'ArrowLeft') {
        if (event.shiftKey) {
            selectedExpression.value.rotation = (selectedExpression.value.rotation || 0) - 1;
        } else {
            selectedExpression.value.offsetX = (selectedExpression.value.offsetX || 0) - 1;
        }
        handled = true;
    } else if (event.key === 'ArrowRight') {
        if (event.shiftKey) {
            selectedExpression.value.rotation = (selectedExpression.value.rotation || 0) + 1;
        } else {
            selectedExpression.value.offsetX = (selectedExpression.value.offsetX || 0) + 1;
        }
        handled = true;
    }
    
    if (handled) {
        event.preventDefault();
    }
};

onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
});

const fetchExpressionComfyDetection = async () => {
    const targetPath = selectedExpression.value?.originalPath || selectedExpression.value?.path;
    if (!targetPath) {
        comfyDetectionData.value = null;
        return;
    }
    try {
        const expressionImagePath = resolveImageUrl(targetPath);
        const url = new URL(expressionImagePath, window.location.origin);
        const imagePath = url.pathname;
        if (!imagePath.startsWith('/mascots/')) {
            comfyDetectionData.value = null;
            return;
        }

        const response = await fetch('/api/get-comfy-detection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imagePath }),
        });
        if (response.ok) {
            const res = await response.json();
            if (res.success && res.exists) {
                comfyDetectionData.value = res.data;
                return;
            }
        }
    } catch (e) {
        console.error('Failed to fetch comfy detection:', e);
    }
    comfyDetectionData.value = null;
};

watch(() => selectedExpression.value?.id, () => {
    fetchExpressionComfyDetection();
});

const drawLandmarksOnCanvas = () => {
    const canvas = debugCanvasRef.value;
    const targetPath = selectedExpression.value?.originalPath || selectedExpression.value?.path;
    if (!canvas || !targetPath || !comfyDetectionData.value) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = Math.max(3, Math.round(canvas.width / 200));
        
        for (const key of ['face_bbox', 'left_eye_bbox', 'right_eye_bbox', 'mouth_bbox']) {
            const bbox = comfyDetectionData.value[key];
            if (bbox) {
                ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
                ctx.fillStyle = '#ef4444';
                ctx.font = `bold ${Math.max(12, Math.round(canvas.width / 40))}px sans-serif`;
                ctx.fillText(key.replace('_bbox', ''), bbox.x, bbox.y - 5);
            }
        }

        ctx.fillStyle = '#22c55e';
        const radius = Math.max(4, Math.round(canvas.width / 120));
        const landmarks = comfyDetectionData.value.landmarks || [];
        for (let i = 0; i < landmarks.length; i++) {
            const pt = landmarks[i];
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.font = `${Math.max(8, Math.round(canvas.width / 80))}px sans-serif`;
            ctx.fillText(String(i), pt.x - 4, pt.y - 6);
            ctx.fillStyle = '#22c55e';
        }
    };
    img.src = resolveImageUrl(targetPath);
};

watch([isCompareModalVisible, comfyDetectionData], () => {
    if (isCompareModalVisible.value && comfyDetectionData.value) {
        setTimeout(drawLandmarksOnCanvas, 100);
    }
});

if (currentExpressions.value.length > 0) {
    if (props.initialExpressionId) {
        selectedExpression.value = currentExpressions.value.find(e => e.id === props.initialExpressionId) || currentExpressions.value.find(e => e.name === '通常') || currentExpressions.value[0] || null;
    } else {
        selectedExpression.value = currentExpressions.value.find(e => e.name === '通常') || currentExpressions.value[0] || null;
    }
}

const extractSinglePart = async (expr: MascotAsset) => {
    if (!expr || isExtractingSingle.value) return;
    
    if (!expr.originalPath) {
        expr.originalPath = expr.path;
    }
    
    const nofacePath = props.nofaceImagePath || `/mascots/users/usr_local_dev_bypass/${props.editingMascot.id}/noface.png`;
    
    const sanitizedLabel = expr.name.replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '_');
    const outfitName = props.activeOutfit?.name.replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '_') || 'default';
    const outputPath = `/mascots/users/usr_local_dev_bypass/${props.editingMascot.id}/expressions/${outfitName}/parts_${sanitizedLabel}.png`;
    
    isExtractingSingle.value = true;
    try {
        const response = await fetch('/api/mascots/extract-parts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nofacePath: nofacePath,
                expressionPath: expr.originalPath,
                outputPath: outputPath,
                offsetX: expr.offsetX || 0,
                offsetY: expr.offsetY || 0,
                scale: expr.scale || 1.0,
                rotation: expr.rotation || 0,
                mode: extractionMode.value
            })
        });
        
        const data = await response.json();
        if (data.success && data.outputPath) {
            expr.path = data.outputPath;
            await updateExtractedParts();
            await fetchExpressionComfyDetection();
            console.log(`[ExtractSingleParts] Extracted for ${expr.name}: ${data.outputPath}`);
        } else {
            alert('パーツの切り出しに失敗しました: ' + (data.error || '不明なエラー'));
        }
    } catch (e) {
        console.error('Failed to extract part:', e);
        alert('パーツ切り出し中にエラーが発生しました。');
    } finally {
        isExtractingSingle.value = false;
    }
};

const triggerAutoAlign = async () => {
    if (!selectedExpression.value || isAligning.value) return;
    
    const baseImg = props.originalImagePath || baseMascotImageUrl.value;
    const exprImg = selectedExpression.value.path;
    
    if (!baseImg || !exprImg) {
        alert('位置合わせを行う画像アセットが見つかりません。');
        return;
    }
    
    if (!window.electronAPI?.alignExpression) {
        alert('自動位置合わせ機能は現在利用できません。');
        return;
    }
    
    isAligning.value = true;
    try {
        const result = await window.electronAPI.alignExpression(baseImg, exprImg, props.detectMode);
        if (result && result.success) {
            if (result.baseWidth) baseNaturalWidth.value = result.baseWidth;
            if (result.baseHeight) baseNaturalHeight.value = result.baseHeight;
            if (result.exprWidth) exprNaturalWidth.value = result.exprWidth;
            if (result.exprHeight) exprNaturalHeight.value = result.exprHeight;

            await nextTick();
            updateDisplayScale();

            const baseW = result.baseWidth || 1536;
            const baseH = result.baseHeight || 1920;
            const exprW = result.exprWidth || 414;
            const exprH = result.exprHeight || 444;

            const exprOvalW = result.exprOvalW || (result.exprEyeDist ? result.exprEyeDist / 0.46 : exprW * 0.9);
            const baseOvalW = props.faceGuide.width;

            const scale = Number(Math.max(0.4, Math.min(2.5, baseOvalW / exprOvalW)).toFixed(3));

            const exprCx = result.exprOvalCX !== undefined ? result.exprOvalCX : (result.exprMidX !== undefined ? result.exprMidX : (exprW / 2.0));
            const exprCy = result.exprOvalCY !== undefined ? result.exprOvalCY : (result.exprMidY !== undefined ? result.exprMidY : (exprH * 0.48));

            const baseCx = props.faceGuide.x;
            const baseCy = props.faceGuide.y;

            const offsetX = (baseCx - baseW / 2.0) - (exprCx - exprW / 2.0) * scale;
            const offsetY = (baseCy - baseH / 2.0) - (exprCy - exprH / 2.0) * scale;

            selectedExpression.value.offsetX = Math.round(offsetX);
            selectedExpression.value.offsetY = Math.round(offsetY);
            selectedExpression.value.scale = scale;
            if (result.fallback) {
                console.log('[AutoAlign] 顔が自動検出されなかったため、標準的な顔の位置（上部中央）に初期配置しました。手動で微調整を行ってください。');
            } else {
                console.log(`[AutoAlign] 自動アライメント成功 (${result.method}): x=${result.offsetX}, y=${result.offsetY}, scale=${result.scale}`);
            }
        } else {
            console.error('Auto alignment failed:', result?.error);
            alert('自動位置合わせの処理に失敗しました。');
        }
    } catch (e) {
        console.error('Error in triggerAutoAlign:', e);
        alert('自動位置合わせ処理中にエラーが発生しました。');
    } finally {
        isAligning.value = false;
    }
};

const resetAlign = () => {
    if (!selectedExpression.value) return;
    selectedExpression.value.offsetX = 0;
    selectedExpression.value.offsetY = 0;
    selectedExpression.value.scale = 1.0;
    selectedExpression.value.rotation = 0;
};

const isDraggingExpression = ref(false);
let exprDragStartMouseX = 0;
let exprDragStartMouseY = 0;
let exprDragStartOffsetX = 0;
let exprDragStartOffsetY = 0;

const startDragExpression = (event: MouseEvent) => {
    if (!selectedExpression.value) return;
    isDraggingExpression.value = true;
    exprDragStartMouseX = event.clientX;
    exprDragStartMouseY = event.clientY;
    exprDragStartOffsetX = selectedExpression.value.offsetX || 0;
    exprDragStartOffsetY = selectedExpression.value.offsetY || 0;
    
    window.addEventListener('mousemove', dragExpression);
    window.addEventListener('mouseup', stopDragExpression);
};

const dragExpression = (event: MouseEvent) => {
    if (!isDraggingExpression.value || !selectedExpression.value) return;
    const dx = (event.clientX - exprDragStartMouseX) / displayScale.value;
    const dy = (event.clientY - exprDragStartMouseY) / displayScale.value;
    
    selectedExpression.value.offsetX = Math.round(exprDragStartOffsetX + dx);
    selectedExpression.value.offsetY = Math.round(exprDragStartOffsetY + dy);
};

const stopDragExpression = () => {
    isDraggingExpression.value = false;
    window.removeEventListener('mousemove', dragExpression);
    window.removeEventListener('mouseup', stopDragExpression);
};

const extractedPartsUrl = ref<string | null>(null);
const isExtractingParts = ref(false);
const partsImageCache = new Map<string, HTMLCanvasElement>();

const performDifferenceExtraction = (imgExpr: HTMLImageElement, imgNoface: HTMLImageElement): HTMLCanvasElement | null => {
    const canvas = document.createElement('canvas');
    const w = imgExpr.naturalWidth || 768;
    const h = imgExpr.naturalHeight || 1280;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const canvasNoface = document.createElement('canvas');
    canvasNoface.width = w;
    canvasNoface.height = h;
    const ctxNoface = canvasNoface.getContext('2d');
    if (!ctxNoface) return null;

    ctx.drawImage(imgExpr, 0, 0);
    ctxNoface.drawImage(imgNoface, 0, 0);

    const imgDataExpr = ctx.getImageData(0, 0, w, h);
    const imgDataNoface = ctxNoface.getImageData(0, 0, w, h);

    const dataExpr = imgDataExpr.data;
    const dataNoface = imgDataNoface.data;
    const len = dataExpr.length;

    for (let i = 0; i < len; i += 4) {
        const r1 = dataExpr[i];
        const g1 = dataExpr[i + 1];
        const b1 = dataExpr[i + 2];
        const a1 = dataExpr[i + 3];

        const r2 = dataNoface[i];
        const g2 = dataNoface[i + 1];
        const b2 = dataNoface[i + 2];
        const a2 = dataNoface[i + 3];

        const diffR = Math.abs(r1 - r2);
        const diffG = Math.abs(g1 - g2);
        const diffB = Math.abs(b1 - b2);
        const diffA = Math.abs(a1 - a2);

        const threshold = 18;
        if (diffR < threshold && diffG < threshold && diffB < threshold && diffA < threshold) {
            dataExpr[i + 3] = 0;
        }
    }

    ctx.putImageData(imgDataExpr, 0, 0);
    return canvas;
};

const getPartsImage = (exprPath: string, nofacePath: string): Promise<HTMLCanvasElement | null> => {
    const cacheKey = `${exprPath}_${nofacePath}`;
    if (partsImageCache.has(cacheKey)) {
        return Promise.resolve(partsImageCache.get(cacheKey)!);
    }

    return new Promise((resolve) => {
        const imgExpr = new Image();
        const imgNoface = new Image();
        let loadedCount = 0;

        const checkLoad = () => {
            loadedCount++;
            if (loadedCount === 2) {
                const partsCanvas = performDifferenceExtraction(imgExpr, imgNoface);
                if (partsCanvas) {
                    partsImageCache.set(cacheKey, partsCanvas);
                }
                resolve(partsCanvas);
            }
        };

        imgExpr.crossOrigin = 'anonymous';
        imgNoface.crossOrigin = 'anonymous';
        imgExpr.onload = checkLoad;
        imgNoface.onload = checkLoad;
        imgExpr.onerror = () => resolve(null);
        imgNoface.onerror = () => resolve(null);

        imgExpr.src = resolveImageUrl(exprPath);
        imgNoface.src = resolveImageUrl(nofacePath);
    });
};

const updateExtractedParts = async () => {
    if (!selectedExpression.value?.path) {
        extractedPartsUrl.value = null;
        return;
    }
    const nofacePath = props.nofaceImagePath || baseMascotImageUrl.value;
    if (!nofacePath) {
        extractedPartsUrl.value = null;
        return;
    }

    isExtractingParts.value = true;
    try {
        const partsCanvas = await getPartsImage(selectedExpression.value.path, nofacePath);
        if (partsCanvas) {
            extractedPartsUrl.value = partsCanvas.toDataURL('image/png');
        } else {
            extractedPartsUrl.value = resolveImageUrl(selectedExpression.value.path);
        }
    } catch (e) {
        console.error('[PartsExtract] 差分抽出エラー:', e);
        extractedPartsUrl.value = resolveImageUrl(selectedExpression.value.path);
    } finally {
        isExtractingParts.value = false;
    }
};

watch(
    () => [selectedExpression.value?.path, props.nofaceImagePath],
    () => {
        updateExtractedParts();
    },
    { immediate: true }
);
</script>

<template>
    <div class="flex-1 flex flex-row">
        <!-- 左側：感情リスト -->
        <div class="w-64 border-r border-slate-200 flex flex-col bg-white">
            <span class="p-4 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider block bg-slate-50">感情スロット一覧</span>
            <div class="flex-1 overflow-y-auto max-h-[500px]">
                <button 
                    v-for="expr in currentExpressions" 
                    :key="expr.id" 
                    @click="selectedExpression = expr"
                    :class="['w-full text-left px-4 py-3 flex items-center space-x-3 transition-colors border-b border-slate-100 last:border-0', selectedExpression?.id === expr.id ? 'bg-primary-50 text-primary-700 font-semibold' : 'hover:bg-slate-50']"
                >
                    <span class="w-2.5 h-2.5 rounded-full bg-slate-400" :class="{'bg-primary-500': selectedExpression?.id === expr.id}"></span>
                    <span class="text-sm">{{ expr.name }}</span>
                </button>
            </div>
        </div>

        <!-- 中央：メインプレビュー -->
        <div class="flex-1 bg-slate-100 p-6 flex items-center justify-center min-h-[400px]">
            <div v-if="selectedExpression" class="relative border border-slate-300 rounded shadow-md overflow-hidden bg-white">
                <!-- のっぺらぼうベース -->
                <img ref="baseImageRef" v-if="baseMascotImageUrl" :src="resolveImageUrl(baseMascotImageUrl)" alt="のっぺらぼう" class="h-[500px] w-auto block" :style="{ opacity: baseOpacity }" @load="onBaseImageLoad" />
                
                <!-- 表情パーツの重ね合わせ -->
                <div 
                    v-if="selectedExpression.path"
                    class="absolute cursor-move select-none"
                    :style="{
                        width: `${exprNaturalWidth * (selectedExpression.scale || 1.0) * displayScale}px`,
                        height: `${exprNaturalHeight * (selectedExpression.scale || 1.0) * displayScale}px`,
                        left: `${(baseNaturalWidth / 2.0 + (selectedExpression.offsetX || 0) - (exprNaturalWidth * (selectedExpression.scale || 1.0)) / 2.0) * displayScale}px`,
                        top: `${(baseNaturalHeight / 2.0 + (selectedExpression.offsetY || 0) - (exprNaturalHeight * (selectedExpression.scale || 1.0)) / 2.0) * displayScale}px`,
                        transform: `rotate(${selectedExpression.rotation || 0}deg)`,
                        transformOrigin: 'center center',
                        opacity: exprOpacity,
                        zIndex: 10
                    }"
                    @mousedown.prevent="startDragExpression"
                >
                    <img 
                        :src="resolveImageUrl(selectedExpression.path)" 
                        alt="表情アセット"
                        class="w-full h-full block pointer-events-none"
                        @load="onExprImageLoad"
                    />
                </div>
            </div>
            <div v-else class="text-slate-400 text-center py-12">
                感情を選択してください。
            </div>
        </div>

        <!-- 右側：設定パネル -->
        <div class="w-80 border-l border-slate-200 p-6 flex flex-col justify-between bg-white overflow-y-auto">
            <div v-if="selectedExpression">
                <h2 class="text-lg font-semibold text-slate-900 mb-4">表情の位置調整</h2>
                <p class="text-sm text-slate-600 mb-4">
                    キーボードの矢印キー (↑↓←→) で1ピクセルずつ移動できます。Shiftキーを押しながらだと、↑↓で拡大率変更、←→で角度を調整できます。
                </p>

                <div class="space-y-4">
                    <div class="space-y-2">
                        <div class="flex justify-between text-xs text-slate-500">
                            <span>拡大率 (Scale)</span>
                            <span>{{ (selectedExpression.scale || 1.0).toFixed(2) }}</span>
                        </div>
                        <Slider v-model="selectedExpression.scale" :min="0.3" :max="2.0" :step="0.01" class="w-full" />
                    </div>

                    <div class="space-y-2">
                        <div class="flex justify-between text-xs text-slate-500">
                            <span>回転 (Rotation)</span>
                            <span>{{ selectedExpression.rotation || 0 }}°</span>
                        </div>
                        <Slider v-model="selectedExpression.rotation" :min="-45" :max="45" class="w-full" />
                    </div>

                    <div class="space-y-2">
                        <div class="flex justify-between text-xs text-slate-500">
                            <span>ベース不透明度</span>
                            <span>{{ Math.round(baseOpacity * 100) }}%</span>
                        </div>
                        <Slider v-model="baseOpacity" :min="0" :max="1" :step="0.01" class="w-full" />
                    </div>

                    <div class="space-y-2">
                        <div class="flex justify-between text-xs text-slate-500">
                            <span>パーツ不透明度</span>
                            <span>{{ Math.round(exprOpacity * 100) }}%</span>
                        </div>
                        <Slider v-model="exprOpacity" :min="0" :max="1" :step="0.01" class="w-full" />
                    </div>
                </div>

                <!-- 切り出しモード選択 -->
                <div class="mt-6 pt-6 border-t border-slate-100 space-y-2">
                    <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">切り出しモード</span>
                    <div class="flex space-x-2">
                        <button 
                            type="button"
                            @click="extractionMode = 'xor'"
                            :class="['flex-1 py-1.5 px-2 text-xs border rounded transition-all font-medium text-center', extractionMode === 'xor' ? 'bg-primary-500 border-primary-500 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50']"
                        >
                            差分抽出 (XOR)
                        </button>
                        <button 
                            type="button"
                            @click="extractionMode = 'comfy'"
                            :class="['flex-1 py-1.5 px-2 text-xs border rounded transition-all font-medium text-center', extractionMode === 'comfy' ? 'bg-primary-500 border-primary-500 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50']"
                        >
                            ComfyUIパーツ検出
                        </button>
                    </div>
                </div>

                <!-- 切り出しパーツ確認プレビュー -->
                <div class="mt-4 pt-4 border-t border-slate-100 space-y-3">
                    <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">切り出しパーツ単体プレビュー (クリックで比較プレビュー)</span>
                    <div 
                        class="w-full h-24 bg-slate-900 border border-slate-700 rounded flex items-center justify-center relative overflow-hidden checkerboard-bg cursor-pointer hover:border-primary-400 transition-all"
                        @click="isCompareModalVisible = true"
                        title="クリックして比較プレビューを表示"
                    >
                        <img 
                            v-if="selectedExpression.path && selectedExpression.path.includes('parts_')" 
                            :src="resolveImageUrl(selectedExpression.path)" 
                            class="max-h-20 max-w-full object-contain" 
                            alt="切り出し済みパーツ"
                        />
                        <span v-else class="text-[10px] text-slate-400">パーツ未切り出し（全体画像の状態）</span>
                    </div>
                    <Button 
                        severity="warning" 
                        class="w-full py-2 font-medium text-xs shadow-sm" 
                        label="このパーツを切り出す" 
                        icon="pi pi-scissors" 
                        :loading="isExtractingSingle"
                        @click="extractSinglePart(selectedExpression)"
                    />
                </div>
            </div>
            <div v-else class="text-slate-400 text-center py-12">
                感情を選択してください。
            </div>

            <div class="pt-6 border-t border-slate-100 space-y-2">
                <Button 
                    severity="primary" 
                    class="w-full py-2 font-medium text-sm shadow-sm" 
                    label="自動位置合わせ" 
                    icon="pi pi-compass" 
                    :loading="isAligning"
                    @click="triggerAutoAlign"
                />
                <Button 
                    severity="secondary" 
                    class="w-full py-2 font-medium text-sm border-slate-300" 
                    label="初期状態にリセット" 
                    icon="pi pi-refresh"
                    @click="resetAlign"
                />
            </div>
        </div>

        <!-- 三連比較プレビューモーダル -->
        <div v-if="isCompareModalVisible" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div class="bg-white rounded-lg shadow-2xl max-w-5xl w-full flex flex-col max-h-[85vh] border border-slate-200 overflow-hidden">
                <!-- ヘッダー -->
                <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div class="flex items-center space-x-2">
                        <i class="pi pi-images text-primary-500 text-lg"></i>
                        <h3 class="text-base font-bold text-slate-800">表情パーツ比較プレビュー</h3>
                        <span v-if="selectedExpression" class="text-xs px-2 py-0.5 rounded bg-primary-100 text-primary-700 font-semibold ml-2">
                            {{ selectedExpression.name }} (切り出しモード: {{ extractionMode === 'xor' ? '差分抽出 (XOR)' : 'ComfyUIパーツ検出' }})
                        </span>
                    </div>
                    <Button icon="pi pi-times" class="p-button-rounded p-button-text p-button-secondary" style="width: 28px; height: 28px; padding: 0;" @click="isCompareModalVisible = false" />
                </div>

                <!-- ボディ (三連並列プレビュー) -->
                <div class="p-6 flex-1 overflow-y-auto min-h-0 bg-slate-100">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                        <!-- 1. 元画像 -->
                        <div class="flex flex-col space-y-2 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider text-center">1. 元表情画像</span>
                            <div class="flex-1 bg-slate-900 rounded border border-slate-700 overflow-hidden relative min-h-[300px] flex items-center justify-center checkerboard-bg">
                                <img 
                                    v-if="selectedExpression?.originalPath || selectedExpression?.path"
                                    :src="resolveImageUrl(selectedExpression.originalPath || selectedExpression.path)" 
                                    class="max-h-[350px] max-w-full object-contain pointer-events-none" 
                                    alt="元表情画像"
                                />
                                <span v-else class="text-xs text-slate-400">画像未登録</span>
                            </div>
                        </div>

                        <!-- 2. BBox ＆ 点群オーバーレイ -->
                        <div class="flex flex-col space-y-2 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider text-center">2. 検出デバッグ (点群＆BBox)</span>
                            <div class="flex-1 bg-slate-900 rounded border border-slate-700 overflow-hidden relative min-h-[300px] flex items-center justify-center checkerboard-bg">
                                <canvas 
                                    v-show="comfyDetectionData"
                                    ref="debugCanvasRef" 
                                    class="max-h-[350px] max-w-full object-contain"
                                ></canvas>
                                <div v-if="!comfyDetectionData" class="text-center p-4 text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
                                    <i class="pi pi-info-circle text-lg"></i>
                                    <span>ComfyUIの顔検出結果データ（JSON）が存在しません。一度「ComfyUIパーツ検出」モードでパーツ切り出しを実行してください。</span>
                                </div>
                            </div>
                        </div>

                        <!-- 3. 切り出し結果 -->
                        <div class="flex flex-col space-y-2 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider text-center">3. 最終切り出し結果</span>
                            <div class="flex-1 bg-slate-900 rounded border border-slate-700 overflow-hidden relative min-h-[300px] flex items-center justify-center checkerboard-bg">
                                <img 
                                    v-if="selectedExpression?.path && selectedExpression.path.includes('parts_')" 
                                    :src="resolveImageUrl(selectedExpression.path)" 
                                    class="max-h-[350px] max-w-full object-contain pointer-events-none" 
                                    alt="切り出し結果"
                                />
                                <span v-else class="text-xs text-slate-400">パーツ未切り出し</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- フッター -->
                <div class="px-6 py-3 border-t border-slate-200 flex justify-end bg-slate-50">
                    <Button label="閉じる" icon="pi pi-times" class="p-button-secondary p-button-sm px-4" @click="isCompareModalVisible = false" />
                </div>
            </div>
        </div>
    </div>
</template>
