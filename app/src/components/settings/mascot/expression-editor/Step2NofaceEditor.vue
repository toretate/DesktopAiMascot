<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue';
import { useConfigStore } from '../../../../store/config';
import Button from 'primevue/button';
import Slider from 'primevue/slider';
import Dropdown from 'primevue/dropdown';

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
    nofaceImagePath: string | null;
    originalImagePath: string | null;
    nofaceCacheQuery: number;
    generateEngine: 'mediapipe' | 'gemini' | 'comfy';
    nofacePrompt: string;
    detectMode: 'ai' | 'anime' | 'comfy';
    faceGuide: {
        x: number;
        y: number;
        width: number;
        height: number;
        baseWidth: number;
        baseHeight: number;
    };
}>();

const emit = defineEmits<{
    (e: 'update:nofaceImagePath', val: string | null): void;
    (e: 'update:originalImagePath', val: string | null): void;
    (e: 'update:nofaceCacheQuery', val: number): void;
    (e: 'update:generateEngine', val: 'mediapipe' | 'gemini' | 'comfy'): void;
    (e: 'update:nofacePrompt', val: string): void;
    (e: 'update:detectMode', val: 'ai' | 'anime' | 'comfy'): void;
    (e: 'save-completed'): void;
    (e: 'back'): void;
}>();

const localGenerateEngine = computed({
    get: () => props.generateEngine,
    set: (val) => emit('update:generateEngine', val)
});

const localNofacePrompt = computed({
    get: () => props.nofacePrompt,
    set: (val) => emit('update:nofacePrompt', val)
});

const localDetectMode = computed({
    get: () => props.detectMode,
    set: (val) => emit('update:detectMode', val)
});

const localNofaceImagePath = computed({
    get: () => props.nofaceImagePath,
    set: (val) => emit('update:nofaceImagePath', val)
});

const localOriginalImagePath = computed({
    get: () => props.originalImagePath,
    set: (val) => emit('update:originalImagePath', val)
});

const localNofaceCacheQuery = computed({
    get: () => props.nofaceCacheQuery,
    set: (val) => emit('update:nofaceCacheQuery', val)
});

const baseNaturalWidth = ref(1);
const baseNaturalHeight = ref(1);
const displayScale = ref(1.0);
const isGeneratingNoface = ref(false);

const canvasRef = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
const isDrawing = ref(false);
const originalImageObj = ref<HTMLImageElement | null>(null);

const brushSize = ref(15);
const activeTool = ref<'brush' | 'eraser' | 'polygon'>('brush');
const selectionPoints = ref<{ x: number; y: number }[]>([]);

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

const geminiApiKeyComputed = computed(() => {
    return props.geminiApiKey || configStore.googleAiStudioApiKey || '';
});

const convertedFaceGuide = computed(() => {
    const baseW = baseNaturalWidth.value || 768;
    const baseH = baseNaturalHeight.value || 1280;
    
    const guideBaseW = props.faceGuide?.baseWidth || baseW;
    const guideBaseH = props.faceGuide?.baseHeight || baseH;
    
    const scaleX = baseW / guideBaseW;
    const scaleY = baseH / guideBaseH;
    
    return {
        x: (props.faceGuide?.x !== undefined ? props.faceGuide.x : (guideBaseW / 2)) * scaleX,
        y: (props.faceGuide?.y !== undefined ? props.faceGuide.y : (guideBaseH / 2)) * scaleY,
        width: (props.faceGuide?.width !== undefined ? props.faceGuide.width : 250) * scaleX,
        height: (props.faceGuide?.height !== undefined ? props.faceGuide.height : 250) * scaleY
    };
});

const zoom = computed(() => {
    if (!baseNaturalWidth.value) return 2.0;
    const targetWidth = convertedFaceGuide.value.width * 2.5;
    return Math.max(1.5, Math.min(4.0, baseNaturalWidth.value / targetWidth));
});

const canvasStyle = computed(() => {
    const zoomVal = zoom.value || 2.0;
    const scale = displayScale.value || 1.0;
    const baseW = baseNaturalWidth.value || 768;
    const baseH = baseNaturalHeight.value || 1280;
    const fgX = convertedFaceGuide.value.x;
    const fgY = convertedFaceGuide.value.y;

    const dx = (baseW / 2 - fgX) * scale;
    const dy = (baseH / 2 - fgY) * scale;
    
    return {
        width: `${baseW * scale}px`,
        height: `${baseH * scale}px`,
        transform: `translate(-50%, -50%) scale(${zoomVal}) translate(${dx}px, ${dy}px)`,
        left: '50%',
        top: '50%',
        position: 'absolute' as const,
        transformOrigin: 'center center'
    };
});

const updateDisplayScale = async () => {
    await nextTick();
    if (baseNaturalHeight.value > 0) {
        const displayedWidth = 500 * (baseNaturalWidth.value / baseNaturalHeight.value);
        if (displayedWidth > 0 && baseNaturalWidth.value > 0) {
            displayScale.value = displayedWidth / baseNaturalWidth.value;
        }
    }
};

const initCanvas = async (imagePath: string) => {
    if (baseMascotImageUrl.value) {
        const origImg = new Image();
        origImg.crossOrigin = 'anonymous';
        origImg.src = `${resolveImageUrl(baseMascotImageUrl.value)}?t=${Date.now()}`;
        await new Promise((resolve) => {
            origImg.onload = () => {
                originalImageObj.value = origImg;
                resolve(null);
            };
            origImg.onerror = () => {
                console.warn('Failed to load original image for eraser function.');
                resolve(null);
            };
        });
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `${resolveImageUrl(imagePath)}?t=${Date.now()}`;
    
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
    });

    const canvas = canvasRef.value;
    if (!canvas) return;
    
    canvas.width = img.naturalWidth || 768;
    canvas.height = img.naturalHeight || 1280;
    
    baseNaturalWidth.value = img.naturalWidth || 768;
    baseNaturalHeight.value = img.naturalHeight || 1280;
    
    ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    updateDisplayScale();
};

const saveEditedNoface = async () => {
    const canvas = canvasRef.value;
    if (!canvas) return;

    isGeneratingNoface.value = true;
    try {
        const imageBase64 = canvas.toDataURL('image/png');
        const response = await fetch('/api/mascots/save-noface', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mascotId: props.editingMascot.id,
                imageBase64: imageBase64
            })
        });
        const data = await response.json();
        if (data.success && data.path) {
            localNofaceImagePath.value = data.path;
            localNofaceCacheQuery.value = Date.now();
            console.log('[ExpressionEditor] Noface image successfully saved on server');
            emit('save-completed');
        }
    } catch (e) {
        console.error('Error saving edited noface:', e);
    } finally {
        isGeneratingNoface.value = false;
    }
};

defineExpose({
    saveEditedNoface
});

const reprocessNoface = async (force: any = true) => {
    const forceFlag = typeof force === 'boolean' ? force : true;
    if (isGeneratingNoface.value) return;
    isGeneratingNoface.value = true;
    try {
        const response = await fetch('/api/mascots/generate-noface', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mascotId: props.editingMascot.id,
                inputPath: baseMascotImageUrl.value,
                detectMode: localDetectMode.value,
                engine: localGenerateEngine.value,
                prompt: localNofacePrompt.value,
                geminiApiKey: geminiApiKeyComputed.value,
                force: forceFlag
            })
        });
        const data = await response.json();
        if (data.success && data.path) {
            localNofaceImagePath.value = data.path;
            localOriginalImagePath.value = baseMascotImageUrl.value;
            localNofaceCacheQuery.value = Date.now();
            
            await nextTick();
            await initCanvas(data.path);
        } else {
            const errMsg = data.error || data.message || data.statusMessage || '不明なエラー';
            console.error('Failed to regenerate noface:', errMsg);
            alert('faceless 画像の生成に失敗しました: ' + errMsg);
        }
    } catch (e) {
        console.error('Error regenerating noface:', e);
        alert('faceless 画像生成中にエラーが発生しました。');
    } finally {
        isGeneratingNoface.value = false;
    }
};

const changeTool = (tool: 'brush' | 'eraser' | 'polygon') => {
    activeTool.value = tool;
    selectionPoints.value = [];
};

const applyPolygonFill = (action: 'fill' | 'restore') => {
    if (selectionPoints.value.length < 3 || !ctx || !canvasRef.value) return;
    
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(selectionPoints.value[0].x, selectionPoints.value[0].y);
    for (let i = 1; i < selectionPoints.value.length; i++) {
        ctx.lineTo(selectionPoints.value[i].x, selectionPoints.value[i].y);
    }
    ctx.closePath();
    ctx.clip();
    
    if (action === 'fill') {
        let sumX = 0, sumY = 0;
        selectionPoints.value.forEach(p => { sumX += p.x; sumY += p.y; });
        const cx = Math.round(sumX / selectionPoints.value.length);
        const cy = Math.round(sumY / selectionPoints.value.length);
        const color = getLocalSkinColor(cx, cy);
        
        ctx.fillStyle = color;
        ctx.fill();
    } else if (action === 'restore' && originalImageObj.value) {
        ctx.drawImage(originalImageObj.value, 0, 0);
    }
    
    ctx.restore();
    selectionPoints.value = [];
};

const getCanvasCoords = (event: MouseEvent) => {
    const canvas = canvasRef.value;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * canvas.height);
    
    return { x, y };
};

const getLocalSkinColor = (x: number, y: number): string => {
    if (!ctx || !canvasRef.value) return 'rgb(255, 255, 255)';
    
    const size = 5;
    const half = Math.floor(size / 2);
    const startX = Math.max(0, x - half);
    const startY = Math.max(0, y - half);
    
    try {
        const imgData = ctx.getImageData(startX, startY, size, size);
        const data = imgData.data;
        
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            const a = data[i+3];
            
            if (a > 0) {
                rSum += r;
                gSum += g;
                bSum += b;
                count++;
            }
        }
        
        if (count > 0) {
            return `rgb(${Math.round(rSum / count)}, ${Math.round(gSum / count)}, ${Math.round(bSum / count)})`;
        }
    } catch (e) {
    }
    
    return 'rgb(255, 224, 200)';
};

const startDrawing = (event: MouseEvent) => {
    if (!ctx) return;
    
    if (activeTool.value === 'polygon') {
        const { x, y } = getCanvasCoords(event);
        selectionPoints.value.push({ x, y });
        return;
    }
    
    isDrawing.value = true;
    draw(event);
};

const draw = (event: MouseEvent) => {
    if (!isDrawing.value || !ctx || !canvasRef.value) return;
    
    const { x, y } = getCanvasCoords(event);
    const rect = canvasRef.value.getBoundingClientRect();
    const pixelRadius = Math.round((brushSize.value / rect.width) * canvasRef.value.width);

    ctx.save();
    
    if (activeTool.value === 'eraser') {
        if (originalImageObj.value) {
            ctx.beginPath();
            ctx.arc(x, y, pixelRadius, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(originalImageObj.value, 0, 0);
        }
    } else {
        ctx.globalCompositeOperation = 'source-over';
        const color = getLocalSkinColor(x, y);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, pixelRadius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
};

const stopDrawing = () => {
    isDrawing.value = false;
};

onMounted(async () => {
    if (props.nofaceImagePath) {
        await initCanvas(props.nofaceImagePath);
    } else {
        await reprocessNoface(false);
    }
});

const defaultPrompts = {
    gemini: '目、眉、口、鼻を完全に消去し、周囲の肌色と滑らかに馴染ませた「faceless」の顔にしてください。髪や輪郭、服、ポーズ、背景などは一切変更せず、完全に元のままとし、顔のパーツ（目・眉・口・鼻）の領域だけを周囲の肌色で自然に埋めてください。最終的な画像のみを出力してください。',
    comfy: 'Remove eyes, eyebrows, mouth, and nose from the face, making the face completely blank/faceless. Keep all other parts like hair, clothes, and outline exactly the same.'
};

watch(localGenerateEngine, (newEngine) => {
    if (newEngine === 'gemini') {
        localNofacePrompt.value = defaultPrompts.gemini;
    } else if (newEngine === 'comfy') {
        localNofacePrompt.value = defaultPrompts.comfy;
    }
});
</script>

<template>
    <div class="flex-1 flex flex-row">
        <!-- 左側プレビュー -->
        <div class="flex-1 bg-slate-100 p-6 flex items-center justify-center min-h-[400px] overflow-hidden relative">
            <!-- ローディング表示 -->
            <div v-if="isGeneratingNoface" class="absolute inset-0 bg-white/60 backdrop-blur-xs flex flex-col items-center justify-center z-10 select-none">
                <i class="pi pi-spin pi-spinner text-3xl text-primary-500 mb-2"></i>
                <span class="text-sm font-medium text-slate-600">処理中...</span>
            </div>

            <div class="relative w-full h-[500px] border border-slate-300 rounded shadow-md overflow-hidden bg-white">
                <canvas 
                    ref="canvasRef"
                    class="cursor-crosshair block absolute"
                    :style="canvasStyle"
                    @mousedown="startDrawing"
                    @mousemove="draw"
                    @mouseup="stopDrawing"
                    @mouseleave="stopDrawing"
                ></canvas>
                <!-- SVG overlay for rendering polygon selection path -->
                <svg 
                    v-if="activeTool === 'polygon' && selectionPoints.length > 0"
                    class="absolute pointer-events-none"
                    :style="canvasStyle"
                >
                    <!-- 選択範囲のポリゴンパス -->
                    <polygon 
                        v-if="selectionPoints.length >= 2"
                        :points="selectionPoints.map(p => `${p.x * displayScale},${p.y * displayScale}`).join(' ')"
                        fill="rgba(56, 189, 248, 0.2)"
                        stroke="rgb(56, 189, 248)"
                        stroke-width="1.5"
                        stroke-dasharray="4"
                    />
                    <!-- 頂点マーカー -->
                    <circle 
                        v-for="(p, idx) in selectionPoints"
                        :key="idx"
                        :cx="p.x * displayScale"
                        :cy="p.y * displayScale"
                        r="4"
                        fill="white"
                        stroke="rgb(14, 165, 233)"
                        stroke-width="2"
                    />
                </svg>
            </div>
        </div>
        <!-- 右側設定パネル -->
        <div class="w-80 border-l border-slate-200 p-6 flex flex-col justify-between bg-white overflow-y-auto">
            <div>
                <h2 class="text-lg font-semibold text-slate-900 mb-4">ベース顔の確認</h2>
                <p class="text-sm text-slate-600 mb-4">
                    AIにより目・鼻・口を消去した顔の仕上がりを確認してください。消し残しがある場合は、画像の上を直接クリック（またはドラッグ）して手動で補正できます。
                </p>

                <!-- のっぺらぼう生成方式 -->
                <div class="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">生成エンジン</span>
                    <Dropdown 
                        v-model="localGenerateEngine" 
                        :options="[
                            { label: 'ローカル画像処理 (MediaPipe/OpenCV)', value: 'mediapipe' },
                            { label: 'マルチモーダルAI (Gemini)', value: 'gemini' },
                            { label: '画像生成AI (ComfyUI:Qwen3 Image Edit)', value: 'comfy' }
                        ]" 
                        optionLabel="label" 
                        optionValue="value" 
                        class="w-full text-sm"
                        @change="reprocessNoface"
                    />
                </div>

                <!-- 顔領域の検出方式 (mediapipe エンジン時のみ表示) -->
                <div v-if="generateEngine === 'mediapipe'" class="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
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
                        @change="reprocessNoface"
                    />
                </div>

                <!-- AI用プロンプト (Gemini / ComfyUI エンジン時に表示) -->
                <div v-if="generateEngine !== 'mediapipe'" class="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">AI消去用プロンプト</span>
                    <textarea 
                        v-model="localNofacePrompt" 
                        rows="4" 
                        class="w-full text-xs p-2 border border-slate-300 rounded focus:ring-primary-500 focus:border-primary-500 bg-white"
                        placeholder="消去指示プロンプトを入力してください"
                    ></textarea>
                    <Button 
                        severity="secondary" 
                        class="w-full py-1.5 text-xs font-medium border-slate-300 mt-1" 
                        label="プロンプトを指定して再生成" 
                        icon="pi pi-refresh" 
                        :loading="isGeneratingNoface"
                        @click="reprocessNoface"
                    />
                </div>

                <!-- レタッチツールボックス -->
                <div class="space-y-4">
                    <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">レタッチツール</span>
                    <div class="flex space-x-2">
                        <Button :severity="activeTool === 'brush' ? 'primary' : 'secondary'" @click="changeTool('brush')" class="flex-1 py-2 font-medium text-xs" label="修復ブラシ" />
                        <Button :severity="activeTool === 'eraser' ? 'primary' : 'secondary'" @click="changeTool('eraser')" class="flex-1 py-2 font-medium text-xs" label="消しゴム" />
                        <Button :severity="activeTool === 'polygon' ? 'primary' : 'secondary'" @click="changeTool('polygon')" class="flex-1 py-2 font-medium text-xs" label="範囲選択" />
                    </div>
                    <div v-show="activeTool !== 'polygon'" class="space-y-2">
                        <div class="flex justify-between text-xs text-slate-500">
                            <span>ブラシサイズ</span>
                            <span>{{ brushSize }}px</span>
                        </div>
                        <Slider v-model="brushSize" :min="5" :max="50" class="w-full" />
                    </div>
                </div>

                <!-- 範囲選択操作ボックス -->
                <div v-if="activeTool === 'polygon'" class="mt-6 p-4 bg-sky-50 border border-sky-100 rounded-lg space-y-3">
                    <span class="text-xs font-semibold text-sky-800 uppercase tracking-wider block">選択範囲のアクション (頂点: {{ selectionPoints.length }})</span>
                    <div class="flex flex-col space-y-2">
                        <Button severity="primary" class="w-full py-2 text-xs font-medium" label="選択範囲を塗りつぶす (消去)" icon="pi pi-clone" :disabled="selectionPoints.length < 3" @click="applyPolygonFill('fill')" />
                        <Button severity="success" class="w-full py-2 text-xs font-medium" label="選択範囲を復元 (元に戻す)" icon="pi pi-undo" :disabled="selectionPoints.length < 3" @click="applyPolygonFill('restore')" />
                        <div class="flex space-x-2">
                            <Button severity="secondary" class="flex-1 py-1.5 text-xs border-slate-300" label="1点戻す" icon="pi pi-arrow-left" :disabled="selectionPoints.length === 0" @click="selectionPoints.pop()" />
                            <Button severity="danger" class="flex-1 py-1.5 text-xs" label="クリア" icon="pi pi-trash" :disabled="selectionPoints.length === 0" @click="selectionPoints = []" />
                        </div>
                    </div>
                    <span class="text-[10px] text-slate-500 leading-normal block">※画像上を3点以上クリックして領域を囲み、「塗りつぶす」または「復元」を実行してください。</span>
                </div>
            </div>
            
            <div class="pt-6 border-t border-slate-100 flex space-x-2">
                <Button severity="secondary" class="flex-1 py-2 text-sm border-slate-300" label="キャンセル" @click="emit('back')" />
                <Button severity="primary" class="flex-1 py-2 text-sm" label="のっぺらぼう保存して完了" @click="saveEditedNoface" :loading="isGeneratingNoface" />
            </div>
        </div>
    </div>
</template>
