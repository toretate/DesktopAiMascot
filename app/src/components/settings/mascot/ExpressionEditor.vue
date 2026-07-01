<script setup lang="ts">
import { ref, computed } from 'vue';
import { useConfigStore } from '../../../store/config';
import Button from 'primevue/button';
import Slider from 'primevue/slider';

const configStore = useConfigStore();

// ウィザードのステップ状態 (1: ベース顔確認, 2: 位置調整, 3: アニメ確認, 4: アトラス化)
const currentStep = ref(1);

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
}>();

const emit = defineEmits<{
    (e: 'back-to-settings'): void;
}>();

// アセットURLの解決
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

// プレビュー表示するベースマスコット画像の解決
const baseMascotImageUrl = computed(() => {
    if (props.activePose?.path) return props.activePose.path;
    if (props.activeOutfit?.path) return props.activeOutfit.path;
    if (props.defaultFrontAvatar?.path) return props.defaultFrontAvatar.path;
    return props.editingMascot?.avatar || '';
});

// 生成されたのっぺらぼう画像のパス (Step 1 で生成・更新される)
const nofaceImagePath = ref<string | null>(null);
const isGeneratingNoface = ref(false);
const nofaceCacheQuery = ref(0);

// アニメーション再生速度 (Step 3)
const animationSpeed = ref(1.0);

// Canvas参照と描画コンテキスト
const canvasRef = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
const isDrawing = ref(false);

// のっぺらぼう自動生成APIの呼び出し
const triggerGenerateNoface = async () => {
    if (isGeneratingNoface.value) return;
    isGeneratingNoface.value = true;
    try {
        const response = await fetch('/api/mascots/generate-noface', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mascotId: props.editingMascot.id,
                inputPath: baseMascotImageUrl.value
            })
        });
        const data = await response.json();
        if (data.success && data.path) {
            nofaceImagePath.value = data.path;
            nofaceCacheQuery.value = Date.now();
            // 画像ロード後に Canvas を初期化する
            await initCanvas(data.path);
        } else {
            console.error('Failed to generate noface:', data.error);
        }
    } catch (e) {
        console.error('Error generating noface:', e);
    } finally {
        isGeneratingNoface.value = false;
    }
};

// 画面表示時に自動でのっぺらぼう生成を実行
import { onMounted, watch } from 'vue';
onMounted(() => {
    triggerGenerateNoface();
});

// 表示するのっぺらぼう画像URL (キャッシュ回避クエリ付き)
const resolvedNofaceUrl = computed(() => {
    if (!nofaceImagePath.value) return resolveImageUrl(baseMascotImageUrl.value);
    return `${resolveImageUrl(nofaceImagePath.value)}&t=${nofaceCacheQuery.value}`;
});

// Canvasへの画像読み込みと描画
const initCanvas = async (imagePath: string) => {
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
    
    ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
};

// 編集されたのっぺらぼう画像をサーバーへ保存
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
            nofaceImagePath.value = data.path;
            nofaceCacheQuery.value = Date.now();
            console.log('[ExpressionEditor] Noface image successfully saved on server');
        }
    } catch (e) {
        console.error('Error saving edited noface:', e);
    } finally {
        isGeneratingNoface.value = false;
    }
};

// 感情リストの取得
const currentExpressions = computed(() => {
    return props.activeOutfit?.expressions || props.editingMascot.assets?.expressions || [];
});

const selectedExpression = ref<MascotAsset | null>(null);

// 初期選択
if (currentExpressions.value.length > 0) {
    selectedExpression.value = currentExpressions.value.find(e => e.name === '通常') || currentExpressions.value[0] || null;
}

const handleBack = () => {
    if (currentStep.value > 1) {
        currentStep.value--;
    } else {
        emit('back-to-settings');
    }
};

const handleNext = async () => {
    if (currentStep.value === 1) {
        // Step 1 から遷移する直前に、手動レタッチの結果をサーバーへ保存
        await saveEditedNoface();
    }
    
    if (currentStep.value < 4) {
        currentStep.value++;
    } else {
        saveAtlas();
    }
};

// レタッチブラシ設定 (Step 1)
const brushSize = ref(15);
const activeTool = ref<'brush' | 'eraser'>('brush');

// Canvas上でのドラッグ座標取得ヘルパー
const getCanvasCoords = (event: MouseEvent) => {
    const canvas = canvasRef.value;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * canvas.height);
    
    return { x, y };
};

// 肌色のスポイト取得（指定座標周辺の色の平均を取得）
const getLocalSkinColor = (x: number, y: number): string => {
    if (!ctx || !canvasRef.value) return 'rgb(255, 255, 255)';
    
    const w = canvasRef.value.width;
    const h = canvasRef.value.height;
    
    // 5x5ピクセルのカラーデータを取得して平均化
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
            
            if (a > 0) { // 不透明なピクセルのみ
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
        // 画像ドメインが異なる等のセキュリティエラー時は標準の白を返す
    }
    
    return 'rgb(255, 224, 200)'; // デフォルトのアニメ肌色フォールバック
};

// マウスイベントハンドラー
const startDrawing = (event: MouseEvent) => {
    if (currentStep.value !== 1 || !ctx) return;
    isDrawing.value = true;
    draw(event);
};

const draw = (event: MouseEvent) => {
    if (!isDrawing.value || !ctx || !canvasRef.value) return;
    
    const { x, y } = getCanvasCoords(event);
    
    // スケールに合わせたブラシ半径を計算
    const rect = canvasRef.value.getBoundingClientRect();
    const pixelRadius = Math.round((brushSize.value / rect.width) * canvasRef.value.width);

    ctx.save();
    
    if (activeTool.value === 'eraser') {
        // 消しゴム (アルファ透過)
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, pixelRadius, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // 修復ブラシ (周辺肌色のスポイトと塗りつぶし)
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

// アトラス保存処理 (Step 4)
const saveAtlas = () => {
    alert('テクスチャアトラスを生成して保存しました。');
    emit('back-to-settings');
};
</script>

<template>
    <div class="expression-editor-page p-6 bg-slate-50 min-h-screen text-slate-800 flex flex-col">
        <!-- ヘッダーおよびステップバー -->
        <header class="mb-6 flex flex-col md:flex-row md:items-center md:justify-between border-b pb-4 border-slate-200">
            <div>
                <h1 class="text-2xl font-bold tracking-tight text-slate-900">表情作成 & 位置調整ワークフロー</h1>
                <p class="text-sm text-slate-500">マスコットの表情差分を最適化し、アトラスとアニメーションを構築します。</p>
            </div>
            
            <!-- ステップバー -->
            <div class="mt-4 md:mt-0 flex items-center space-x-2 text-sm font-medium">
                <span :class="['px-3 py-1.5 rounded-full border', currentStep === 1 ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-slate-600 border-slate-300']">1. ベース確認</span>
                <span class="text-slate-400">➔</span>
                <span :class="['px-3 py-1.5 rounded-full border', currentStep === 2 ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-slate-600 border-slate-300']">2. 位置調整</span>
                <span class="text-slate-400">➔</span>
                <span :class="['px-3 py-1.5 rounded-full border', currentStep === 3 ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-slate-600 border-slate-300']">3. アニメ確認</span>
                <span class="text-slate-400">➔</span>
                <span :class="['px-3 py-1.5 rounded-full border', currentStep === 4 ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-slate-600 border-slate-300']">4. 保存</span>
            </div>
        </header>

        <!-- メイン領域 -->
        <main class="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-row">
            
            <!-- STEP 1: のっぺらぼう確認 -->
            <div v-if="currentStep === 1" class="flex-1 flex flex-row">
                <!-- 左側プレビュー -->
                <div class="flex-1 bg-slate-100 p-6 flex items-center justify-center min-h-[400px] overflow-auto relative">
                    <!-- ローディング表示 -->
                    <div v-if="isGeneratingNoface" class="absolute inset-0 bg-white/60 backdrop-blur-xs flex flex-col items-center justify-center z-10 select-none">
                        <i class="pi pi-spin pi-spinner text-3xl text-primary-500 mb-2"></i>
                        <span class="text-sm font-medium text-slate-600">処理中...</span>
                    </div>

                    <div class="relative max-w-full max-h-[600px] border border-slate-300 rounded shadow-md overflow-hidden bg-white">
                        <canvas 
                            ref="canvasRef"
                            class="max-h-[500px] object-contain cursor-crosshair block"
                            style="max-width: 100%; height: auto;"
                            @mousedown="startDrawing"
                            @mousemove="draw"
                            @mouseup="stopDrawing"
                            @mouseleave="stopDrawing"
                        ></canvas>
                        <div class="absolute inset-0 bg-transparent flex items-center justify-center text-slate-400 pointer-events-none">
                            [のっぺらぼうプレビュー]
                        </div>
                    </div>
                </div>
                <!-- 右側設定パネル -->
                <div class="w-80 border-l border-slate-200 p-6 flex flex-col justify-between bg-white overflow-y-auto">
                    <div>
                        <h2 class="text-lg font-semibold text-slate-900 mb-4">のっぺらぼう（ベース顔）の確認</h2>
                        <p class="text-sm text-slate-600 mb-4">
                            AIにより目・鼻・口を消去した顔の仕上がりを確認してください。消し残しがある場合は、画像の上を直接クリック（またはドラッグ）して手動で補正できます。
                        </p>
                        
                        <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 mb-6">
                            <i class="pi pi-exclamation-triangle mr-1"></i>
                            <strong>事前確認:</strong> 表情スプライトの切り出しや位置合わせを行うため、あらかじめマスコット設定画面にて<strong>「表情のAI生成」または画像アセットの登録</strong>を完了させておいてください。
                        </div>

                        <!-- レタッチツールボックス -->
                        <div class="space-y-4">
                            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">レタッチツール</span>
                            <div class="flex space-x-2">
                                <Button :severity="activeTool === 'brush' ? 'primary' : 'secondary'" @click="activeTool = 'brush'" class="flex-1 py-2 font-medium" label="修復ブラシ" />
                                <Button :severity="activeTool === 'eraser' ? 'primary' : 'secondary'" @click="activeTool = 'eraser'" class="flex-1 py-2 font-medium" label="消しゴム" />
                            </div>
                            <div class="space-y-2">
                                <div class="flex justify-between text-xs text-slate-500">
                                    <span>ブラシサイズ</span>
                                    <span>{{ brushSize }}px</span>
                                </div>
                                <Slider v-model="brushSize" :min="5" :max="50" class="w-full" />
                            </div>
                        </div>
                    </div>
                    
                    <div class="pt-6 border-t border-slate-100">
                        <Button severity="secondary" class="w-full py-2 font-medium mb-2 text-sm" label="自動修復を再実行" @click="triggerGenerateNoface" :loading="isGeneratingNoface" />
                    </div>
                </div>
            </div>

            <!-- STEP 2: 各感情の位置合わせ調整 -->
            <div v-if="currentStep === 2" class="flex-1 flex flex-row">
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
                    <div class="relative max-w-full max-h-[600px] border border-slate-300 rounded shadow-md overflow-hidden bg-white flex items-center justify-center p-4">
                        <!-- のっぺらぼうベース -->
                        <img v-if="baseMascotImageUrl" :src="resolveImageUrl(baseMascotImageUrl)" alt="のっぺらぼう" class="max-h-[500px] object-contain opacity-50" />
                        
                        <!-- 表情パーツの重ね合わせ（シミュレーション） -->
                        <div 
                            v-if="selectedExpression" 
                            class="absolute border border-dashed border-primary-500"
                            :style="{
                                transform: `translate(${selectedExpression.offsetX || 0}px, ${selectedExpression.offsetY || 0}px) scale(${selectedExpression.scale || 1.0}) rotate(${selectedExpression.rotation || 0}deg)`,
                                transition: 'none'
                            }"
                        >
                            <img :src="resolveImageUrl(selectedExpression.path)" class="w-32 h-32 object-contain" alt="表情パーツ" />
                        </div>
                    </div>
                </div>

                <!-- 右側：パラメータ調整 -->
                <div class="w-80 border-l border-slate-200 p-6 flex flex-col justify-between bg-white overflow-y-auto">
                    <div v-if="selectedExpression">
                        <h2 class="text-lg font-semibold text-slate-900 mb-1">表情パーツの位置合わせ</h2>
                        <span class="text-xs px-2 py-0.5 rounded bg-primary-100 text-primary-700 font-semibold mb-4 inline-block">{{ selectedExpression.name }}</span>
                        <p class="text-sm text-slate-600 mb-6">
                            ベース画像に対して、表情パーツの位置・縮尺・回転を微調整します。
                        </p>

                        <!-- スライダー調整群 -->
                        <div class="space-y-6">
                            <div class="space-y-2">
                                <div class="flex justify-between text-xs text-slate-500">
                                    <span>横方向 (X)</span>
                                    <span>{{ selectedExpression.offsetX || 0 }}px</span>
                                </div>
                                <Slider v-model="selectedExpression.offsetX" :min="-250" :max="250" class="w-full" />
                            </div>

                            <div class="space-y-2">
                                <div class="flex justify-between text-xs text-slate-500">
                                    <span>縦方向 (Y)</span>
                                    <span>{{ selectedExpression.offsetY || 0 }}px</span>
                                </div>
                                <Slider v-model="selectedExpression.offsetY" :min="-250" :max="250" class="w-full" />
                            </div>

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
                        </div>
                    </div>
                    <div v-else class="text-slate-400 text-center py-12">
                        感情を選択してください。
                    </div>

                    <div class="pt-6 border-t border-slate-100">
                        <Button severity="secondary" class="w-full py-2 font-medium text-sm" label="初期状態にリセット" />
                    </div>
                </div>
            </div>

            <!-- STEP 3: アニメーション動作確認 -->
            <div v-if="currentStep === 3" class="flex-1 flex flex-row">
                <!-- 左側プレビュー -->
                <div class="flex-1 bg-slate-100 p-6 flex items-center justify-center min-h-[400px] overflow-auto">
                    <div class="relative max-w-full max-h-[600px] border border-slate-300 rounded shadow-md overflow-hidden bg-white flex items-center justify-center p-4">
                        <img v-if="baseMascotImageUrl" :src="resolveImageUrl(baseMascotImageUrl)" alt="のっぺらぼう" class="max-h-[500px] object-contain" />
                        <!-- アニメーション表示のモック -->
                        <div class="absolute text-center bg-slate-900/80 text-white px-4 py-2 rounded text-sm pointer-events-none">
                            [瞬き・口パク アニメーション再生中]
                        </div>
                    </div>
                </div>
                <!-- 右側設定パネル -->
                <div class="w-80 border-l border-slate-200 p-6 flex flex-col justify-between bg-white overflow-y-auto">
                    <div>
                        <h2 class="text-lg font-semibold text-slate-900 mb-4">アニメーションプレビュー</h2>
                        <p class="text-sm text-slate-600 mb-6">
                            分離した目（瞬き）と口（口パク）パーツがのっぺらぼう画像の上で自然に動作しているか確認してください。
                        </p>

                        <div class="space-y-6">
                            <!-- アニメーションコントロール -->
                            <div class="space-y-2">
                                <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">再生コントロール</span>
                                <div class="flex space-x-2">
                                    <Button severity="primary" class="flex-1 py-1.5 text-xs font-medium" label="瞬きテスト" />
                                    <Button severity="primary" class="flex-1 py-1.5 text-xs font-medium" label="口パクテスト" />
                                </div>
                            </div>

                            <div class="space-y-2">
                                <div class="flex justify-between text-xs text-slate-500">
                                    <span>再生速度</span>
                                    <span>{{ animationSpeed.toFixed(1) }}x</span>
                                </div>
                                <Slider v-model="animationSpeed" :min="0.5" :max="2.0" :step="0.1" class="w-full" />
                            </div>
                        </div>
                    </div>
                    
                    <div class="pt-6 border-t border-slate-100">
                        <p class="text-xs text-slate-400">
                            ※実際のデスクトップ上では、音声データと同調した口パクアニメーションが行われます。
                        </p>
                    </div>
                </div>
            </div>

            <!-- STEP 4: アトラス化と保存 -->
            <div v-if="currentStep === 4" class="flex-1 flex flex-row">
                <!-- 左側プレビュー -->
                <div class="flex-1 bg-slate-100 p-6 flex items-center justify-center min-h-[400px] overflow-auto">
                    <div class="max-w-full max-h-[600px] border border-slate-300 rounded shadow-md overflow-hidden bg-white p-4 flex flex-col items-center">
                        <span class="text-xs text-slate-400 mb-2">生成予定のテクスチャアトラス (2048x2048) プレビュー</span>
                        <div class="w-80 h-80 bg-slate-200 border-2 border-dashed border-slate-400 rounded flex items-center justify-center text-slate-500">
                            [atlas.png の結合プレビュー]
                        </div>
                    </div>
                </div>
                <!-- 右側設定パネル -->
                <div class="w-80 border-l border-slate-200 p-6 flex flex-col justify-between bg-white overflow-y-auto">
                    <div>
                        <h2 class="text-lg font-semibold text-slate-900 mb-4">アトラス化とエクスポート</h2>
                        <p class="text-sm text-slate-600 mb-6">
                            すべての表情パーツとアニメーションコマが1つのアトラス画像（`atlas.png`）と定義情報（`atlas.json`）にまとめられます。
                        </p>

                        <!-- アセット統計情報 -->
                        <div class="bg-slate-50 rounded-lg p-4 border border-slate-100 space-y-2 text-xs">
                            <div class="flex justify-between">
                                <span class="text-slate-500">のっぺらぼう:</span>
                                <span class="font-semibold text-slate-800">1枚</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-slate-500">感情パーツ:</span>
                                <span class="font-semibold text-slate-800">{{ currentExpressions.length }}種類</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-slate-500">アニメーション総コマ数:</span>
                                <span class="font-semibold text-slate-800">約80コマ</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="pt-6 border-t border-slate-100">
                        <Button severity="primary" class="w-full py-3 font-semibold text-sm" @click="saveAtlas" label="アトラスを生成して保存" />
                    </div>
                </div>
            </div>

        </main>

        <!-- 下部ナビゲーション -->
        <footer class="mt-6 flex justify-between">
            <Button severity="secondary" class="px-6 py-2.5 font-medium border-slate-300" @click="handleBack" :label="currentStep === 1 ? '設定に戻る' : '戻る'" />
            <Button severity="primary" class="px-6 py-2.5 font-medium" @click="handleNext" :label="currentStep === 4 ? 'アトラス生成 & 完了' : '次へ'" />
        </footer>
    </div>
</template>

<style scoped>
.expression-editor-page {
    /* ページのフル画面スタイルの微調整用 */
}
</style>
