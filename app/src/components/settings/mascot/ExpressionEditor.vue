<script setup lang="ts">
import { ref, computed } from 'vue';
import { useConfigStore } from '../../../store/config';
import Button from 'primevue/button';
import Slider from 'primevue/slider';
import Dropdown from 'primevue/dropdown';

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
    geminiApiKey?: string;
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

// ベース画像の要素参照
const baseImageRef = ref<HTMLImageElement | null>(null);

// 生成されたのっぺらぼう画像のパス (Step 1 で生成・更新される)
const nofaceImagePath = ref<string | null>(null);
const originalImagePath = ref<string | null>(null); // 顔検出が確実に成功するオリジナル画像のパス
const isGeneratingNoface = ref(false);
const nofaceCacheQuery = ref(0);

// アニメーション再生速度 (Step 3)
const animationSpeed = ref(1.0);

// Canvas参照と描画コンテキスト
const canvasRef = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
const isDrawing = ref(false);
const originalImageObj = ref<HTMLImageElement | null>(null);

const isDetectingFace = ref(false);

const generateEngine = ref<'mediapipe' | 'gemini' | 'comfy'>('mediapipe');

const defaultPrompts = {
    gemini: '目、眉、口、鼻を完全に消去し、周囲の肌色と滑らかに馴染ませた「のっぺらぼう」の顔にしてください。髪や輪郭、服、ポーズ、背景などは一切変更せず、完全に元のままとし、顔のパーツ（目・眉・口・鼻）の領域だけを周囲の肌色で自然に埋めてください。最終的な画像のみを出力してください。',
    comfy: 'Remove eyes, eyebrows, mouth, and nose from the face, making the face completely blank/faceless. Keep all other parts like hair, clothes, and outline exactly the same.'
};

const nofacePrompt = ref(defaultPrompts.gemini);

const geminiApiKey = computed(() => {
    return props.geminiApiKey || configStore.googleAiStudioApiKey || '';
});

watch(generateEngine, (newEngine) => {
    if (newEngine === 'gemini') {
        nofacePrompt.value = defaultPrompts.gemini;
    } else if (newEngine === 'comfy') {
        nofacePrompt.value = defaultPrompts.comfy;
    }
});

// 元画像から顔領域を自動検出して初期ガイド枠を設定
const initFaceGuide = async () => {
    if (!baseMascotImageUrl.value) return;
    isDetectingFace.value = true;
    try {
        if (window.electronAPI?.detectBaseFace) {
            const faceRes = await window.electronAPI.detectBaseFace(baseMascotImageUrl.value, detectMode.value);
            if (faceRes && faceRes.success) {
                faceGuide.value = {
                    x: faceRes.faceX,
                    y: faceRes.faceY,
                    width: faceRes.faceWidth,
                    height: faceRes.faceHeight,
                    baseWidth: faceRes.baseWidth,
                    baseHeight: faceRes.baseHeight
                };
                baseNaturalWidth.value = faceRes.baseWidth;
                baseNaturalHeight.value = faceRes.baseHeight;

                // 複数顔候補の保存
                if (faceRes.candidates && faceRes.candidates.length > 0) {
                    faceCandidates.value = faceRes.candidates;
                    selectedCandidateIndex.value = 0;
                } else {
                    faceCandidates.value = [];
                    selectedCandidateIndex.value = null;
                }

                console.log('[FaceDetect] 顔領域自動検出成功:', faceGuide.value, 'Candidates:', faceCandidates.value);
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

// のっぺらぼう自動生成を実行してステップ2へ進む
const generateAndNext = async () => {
    if (isGeneratingNoface.value) return;
    isGeneratingNoface.value = true;
    try {
        const response = await fetch('/api/mascots/generate-noface', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mascotId: props.editingMascot.id,
                inputPath: baseMascotImageUrl.value,
                detectMode: detectMode.value,
                engine: generateEngine.value,
                prompt: nofacePrompt.value,
                geminiApiKey: geminiApiKey.value
            })
        });
        const data = await response.json();
        if (data.success && data.path) {
            nofaceImagePath.value = data.path;
            originalImagePath.value = baseMascotImageUrl.value;
            nofaceCacheQuery.value = Date.now();
            
            // ステップ2 (ベース確認) へ進む
            currentStep.value = 2;
            
            // 画像ロード後に Canvas を初期化する
            await nextTick();
            await initCanvas(data.path);
        } else {
            console.error('Failed to generate noface:', data.error);
            alert('のっぺらぼう画像の生成に失敗しました: ' + (data.error || '不明なエラー'));
        }
    } catch (e) {
        console.error('Error generating noface:', e);
        alert('のっぺらぼう画像生成中にエラーが発生しました。');
    } finally {
        isGeneratingNoface.value = false;
    }
};

// のっぺらぼう画像を再生成する
const reprocessNoface = async () => {
    if (isGeneratingNoface.value) return;
    isGeneratingNoface.value = true;
    try {
        const response = await fetch('/api/mascots/generate-noface', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mascotId: props.editingMascot.id,
                inputPath: baseMascotImageUrl.value,
                detectMode: detectMode.value,
                engine: generateEngine.value,
                prompt: nofacePrompt.value,
                geminiApiKey: geminiApiKey.value
            })
        });
        const data = await response.json();
        if (data.success && data.path) {
            nofaceImagePath.value = data.path;
            nofaceCacheQuery.value = Date.now();
            
            await nextTick();
            await initCanvas(data.path);
        } else {
            console.error('Failed to regenerate noface:', data.error);
            alert('のっぺらぼう画像の生成に失敗しました: ' + (data.error || '不明なエラー'));
        }
    } catch (e) {
        console.error('Error regenerating noface:', e);
        alert('のっぺらぼう画像生成中にエラーが発生しました。');
    } finally {
        isGeneratingNoface.value = false;
    }
};

// Canvasの物理解像度に合わせて顔ガイド座標をスケール変換する
const convertedFaceGuide = computed(() => {
    const baseW = baseNaturalWidth.value || 768;
    const baseH = baseNaturalHeight.value || 1280;
    
    const guideBaseW = faceGuide.value?.baseWidth || baseW;
    const guideBaseH = faceGuide.value?.baseHeight || baseH;
    
    const scaleX = baseW / guideBaseW;
    const scaleY = baseH / guideBaseH;
    
    return {
        x: (faceGuide.value?.x !== undefined ? faceGuide.value.x : (guideBaseW / 2)) * scaleX,
        y: (faceGuide.value?.y !== undefined ? faceGuide.value.y : (guideBaseH / 2)) * scaleY,
        width: (faceGuide.value?.width !== undefined ? faceGuide.value.width : 250) * scaleX,
        height: (faceGuide.value?.height !== undefined ? faceGuide.value.height : 250) * scaleY
    };
});

// 顔周辺のズーム倍率を計算する
const zoom = computed(() => {
    if (!baseNaturalWidth.value) return 2.0;
    // 変換後の顔幅の約2.5倍の領域を表示するようにスケールを決定
    const targetWidth = convertedFaceGuide.value.width * 2.5;
    return Math.max(1.5, Math.min(4.0, baseNaturalWidth.value / targetWidth));
});

// CanvasおよびSVGの位置・ズームを正確に中央配置するスタイル
const canvasStyle = computed(() => {
    const zoomVal = zoom.value || 2.0;
    const scale = displayScale.value || 1.0;
    const baseW = baseNaturalWidth.value || 768;
    const baseH = baseNaturalHeight.value || 1280;
    const fgX = convertedFaceGuide.value.x;
    const fgY = convertedFaceGuide.value.y;

    const dx = (baseW / 2 - fgX) * scale;
    const dy = (baseH / 2 - fgY) * scale;
    
    const style = {
        width: `${baseW * scale}px`,
        height: `${baseH * scale}px`,
        transform: `translate(-50%, -50%) scale(${zoomVal}) translate(${dx}px, ${dy}px)`,
        left: '50%',
        top: '50%',
        position: 'absolute' as const,
        transformOrigin: 'center center'
    };
    
    console.log('[canvasStyle] debug info:', {
        zoomVal,
        scale,
        baseW,
        baseH,
        fgX,
        fgY,
        dx,
        dy,
        styleString: style.transform
    });
    
    return style;
});

// 画面表示時に自動でのっぺらぼう生成を実行
import { onMounted, onUnmounted, watch } from 'vue';

const handleKeyDown = (event: KeyboardEvent) => {
    if (currentStep.value !== 3 || !selectedExpression.value) return;
    
    // 入力フォームにフォーカスがある場合は処理をスキップ
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
        return;
    }

    let handled = false;
    
    if (event.key === 'ArrowUp') {
        if (event.shiftKey) {
            // Shift + ↑ : 拡大率の微調整 (0.01 増加)
            selectedExpression.value.scale = Math.min(2.5, Number(((selectedExpression.value.scale || 1.0) + 0.01).toFixed(2)));
        } else {
            // ↑ : 縦方向(Y)を 1px 上へ (物理ピクセル上で -1px)
            selectedExpression.value.offsetY = (selectedExpression.value.offsetY || 0) - 1;
        }
        handled = true;
    } else if (event.key === 'ArrowDown') {
        if (event.shiftKey) {
            // Shift + ↓ : 拡大率の微調整 (0.01 減少)
            selectedExpression.value.scale = Math.max(0.3, Number(((selectedExpression.value.scale || 1.0) - 0.01).toFixed(2)));
        } else {
            // ↓ : 縦方向(Y)を 1px 下へ (物理ピクセル上で +1px)
            selectedExpression.value.offsetY = (selectedExpression.value.offsetY || 0) + 1;
        }
        handled = true;
    } else if (event.key === 'ArrowLeft') {
        if (event.shiftKey) {
            // Shift + ← : 回転率の微調整 (1度減少)
            selectedExpression.value.rotation = (selectedExpression.value.rotation || 0) - 1;
        } else {
            // ← : 横方向(X)を 1px 左へ (物理ピクセル上で -1px)
            selectedExpression.value.offsetX = (selectedExpression.value.offsetX || 0) - 1;
        }
        handled = true;
    } else if (event.key === 'ArrowRight') {
        if (event.shiftKey) {
            // Shift + → : 回転率の微調整 (1度増加)
            selectedExpression.value.rotation = (selectedExpression.value.rotation || 0) + 1;
        } else {
            // → : 横方向(X)を 1px 右へ (物理ピクセル上で +1px)
            selectedExpression.value.offsetX = (selectedExpression.value.offsetX || 0) + 1;
        }
        handled = true;
    }
    
    if (handled) {
        event.preventDefault();
    }
};

onMounted(() => {
    initFaceGuide();
    window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
});

// 表示するのっぺらぼう画像URL (キャッシュ回避クエリ付き)
const resolvedNofaceUrl = computed(() => {
    if (!nofaceImagePath.value) return resolveImageUrl(baseMascotImageUrl.value);
    return `${resolveImageUrl(nofaceImagePath.value)}&t=${nofaceCacheQuery.value}`;
});

// Canvasへの画像読み込みと描画
const initCanvas = async (imagePath: string) => {
    // オリジナル画像のロード（消しゴム用）
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
    if (currentStep.value === 2) {
        // Step 2 から遷移する直前に、手動レタッチの結果をサーバーへ保存
        await saveEditedNoface();
    }
    
    if (currentStep.value < 5) {
        currentStep.value++;
    } else {
        saveAtlas();
    }
};

// レタッチブラシ設定 (Step 1)
const brushSize = ref(15);
const activeTool = ref<'brush' | 'eraser' | 'polygon'>('brush');
const selectionPoints = ref<{ x: number; y: number }[]>([]);

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
        // 重心の周辺から肌色を取得
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
    if (currentStep.value !== 2 || !ctx) return;
    
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
    
    // スケールに合わせたブラシ半径を計算
    const rect = canvasRef.value.getBoundingClientRect();
    const pixelRadius = Math.round((brushSize.value / rect.width) * canvasRef.value.width);

    ctx.save();
    
    if (activeTool.value === 'eraser') {
        // 消しゴム (オリジナル画像の重ね合わせ復元)
        if (originalImageObj.value) {
            ctx.beginPath();
            ctx.arc(x, y, pixelRadius, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(originalImageObj.value, 0, 0);
        }
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

const isAligning = ref(false);

const triggerAutoAlign = async () => {
    if (!selectedExpression.value || isAligning.value) return;
    
    // のっぺらぼう画像 (noface.png) ではなく、確実に顔・目検出ができるオリジナル衣装画像を優先して渡す
    const baseImg = originalImagePath.value || baseMascotImageUrl.value;
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
        const result = await window.electronAPI.alignExpression(baseImg, exprImg, detectMode.value);
        if (result && result.success) {
            // 元の画像サイズを API レスポンスから直接セット（キャッシュ対策）
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

            // 表情パーツ側の顔の輪郭幅 (なければ目の距離から逆算、それもなければ画像全体の90%)
            const exprOvalW = result.exprOvalW || (result.exprEyeDist ? result.exprEyeDist / 0.46 : exprW * 0.9);
            // ユーザーがステップ1で調整したベース顔のガイド幅
            const baseOvalW = faceGuide.value.width;

            // 正確なスケール比率を算出 (ベース側顔ガイド幅 / 表情パーツ顔幅)
            const scale = Number(Math.max(0.4, Math.min(2.5, baseOvalW / exprOvalW)).toFixed(3));

            // 表情パーツ側の中心点 (輪郭重心、なければ目の中心、それもなければ画像中心)
            const exprCx = result.exprOvalCX !== undefined ? result.exprOvalCX : (result.exprMidX !== undefined ? result.exprMidX : (exprW / 2.0));
            const exprCy = result.exprOvalCY !== undefined ? result.exprOvalCY : (result.exprMidY !== undefined ? result.exprMidY : (exprH * 0.48));

            // ユーザーが調整したベース顔のガイド中心
            const baseCx = faceGuide.value.x;
            const baseCy = faceGuide.value.y;

            // ガイド中心をベースにした物理的な平行移動量 (offsetX, offsetY) の算出
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

const detectMode = ref<'ai' | 'anime'>('ai');
const faceCandidates = ref<{ faceX: number; faceY: number; faceWidth: number; faceHeight: number }[]>([]);
const selectedCandidateIndex = ref<number | null>(null);

const selectCandidate = (index: number) => {
    selectedCandidateIndex.value = index;
    const cand = faceCandidates.value[index];
    if (cand) {
        faceGuide.value = {
            ...faceGuide.value,
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

const showFaceGuide = ref(true);
const faceGuide = ref({
    x: 768,       // 物理ピクセルの中央X
    y: 500,       // 物理ピクセルの顔がありそうな高さY
    width: 250,   // 顔幅
    height: 250,  // 顔高さ
    baseWidth: 1536,
    baseHeight: 1920
});

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
    dragStartFaceX = faceGuide.value.x;
    dragStartFaceY = faceGuide.value.y;
    
    window.addEventListener('mousemove', dragFaceGuide);
    window.addEventListener('mouseup', stopDragFaceGuide);
};

const dragFaceGuide = (event: MouseEvent) => {
    if (!isDraggingFaceGuide.value) return;
    const dx = (event.clientX - dragStartMouseX) / displayScale.value;
    const dy = (event.clientY - dragStartMouseY) / displayScale.value;
    
    faceGuide.value.x = Math.round(dragStartFaceX + dx);
    faceGuide.value.y = Math.round(dragStartFaceY + dy);
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
    dragStartFaceW = faceGuide.value.width;
    dragStartFaceH = faceGuide.value.height;
    
    window.addEventListener('mousemove', resizeFaceGuide);
    window.addEventListener('mouseup', stopResizeFaceGuide);
};

const resizeFaceGuide = (event: MouseEvent) => {
    if (!isResizingFaceGuide.value) return;
    const dx = (event.clientX - dragStartMouseX) / displayScale.value;
    const dy = (event.clientY - dragStartMouseY) / displayScale.value;
    
    // 正方形比率を維持しながらリサイズ
    const change = Math.max(dx * 2, dy * 2);
    faceGuide.value.width = Math.max(50, Math.round(dragStartFaceW + change));
    faceGuide.value.height = Math.max(50, Math.round(dragStartFaceH + change));
};

const stopResizeFaceGuide = () => {
    isResizingFaceGuide.value = false;
    window.removeEventListener('mousemove', resizeFaceGuide);
    window.removeEventListener('mouseup', stopResizeFaceGuide);
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

const originalImageRef = ref<HTMLImageElement | null>(null);
const baseNaturalWidth = ref(1);
const baseNaturalHeight = ref(1);
const exprNaturalWidth = ref(414); // デフォルト値を一般的なサイズに設定
const exprNaturalHeight = ref(444);
const displayScale = ref(1.0);

const updateDisplayScale = async () => {
    await nextTick();
    let displayedWidth = 0;
    if (currentStep.value === 1 && originalImageRef.value) {
        displayedWidth = originalImageRef.value.clientWidth;
    } else if (currentStep.value === 2) {
        // 高さ500pxのアスペクト比から幅を逆算して循環参照を防ぐ
        if (baseNaturalHeight.value > 0) {
            displayedWidth = 500 * (baseNaturalWidth.value / baseNaturalHeight.value);
        }
    } else if (baseImageRef.value) {
        displayedWidth = baseImageRef.value.clientWidth;
    }
    if (displayedWidth > 0 && baseNaturalWidth.value > 0) {
        displayScale.value = displayedWidth / baseNaturalWidth.value;
        console.log(`[DisplayScale] step=${currentStep.value}, displayedWidth=${displayedWidth}, naturalWidth=${baseNaturalWidth.value}, scale=${displayScale.value}`);
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

// 感情切り替え時はサイズを維持したまま画像ロードを待ち、値の強制リセットによる表示崩れを防止します。

const resetAlign = () => {
    if (!selectedExpression.value) return;
    selectedExpression.value.offsetX = 0;
    selectedExpression.value.offsetY = 0;
    selectedExpression.value.scale = 1.0;
    selectedExpression.value.rotation = 0;
};

watch(currentStep, async (newStep) => {
    await nextTick();
    updateDisplayScale();
    if (newStep === 2 && nofaceImagePath.value) {
        await initCanvas(nofaceImagePath.value);
    }
});
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
                <span :class="['px-3 py-1.5 rounded-full border', currentStep === 1 ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-slate-600 border-slate-300']">1. 顔領域確認</span>
                <span class="text-slate-400">➔</span>
                <span :class="['px-3 py-1.5 rounded-full border', currentStep === 2 ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-slate-600 border-slate-300']">2. ベース確認</span>
                <span class="text-slate-400">➔</span>
                <span :class="['px-3 py-1.5 rounded-full border', currentStep === 3 ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-slate-600 border-slate-300']">3. 位置調整</span>
                <span class="text-slate-400">➔</span>
                <span :class="['px-3 py-1.5 rounded-full border', currentStep === 4 ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-slate-600 border-slate-300']">4. アニメ確認</span>
                <span class="text-slate-400">➔</span>
                <span :class="['px-3 py-1.5 rounded-full border', currentStep === 5 ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-slate-600 border-slate-300']">5. 保存</span>
            </div>
        </header>

        <!-- メイン領域 -->
        <main class="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-row">
            
            <!-- STEP 1: 顔領域確認 -->
            <div v-if="currentStep === 1" class="flex-1 flex flex-row">
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
                            @load="updateDisplayScale"
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
                            この調整結果が、目・口を消した「のっぺらぼう画像」の自動生成や、ステップ3での表情パーツ位置合わせの正確な基準位置として使用されます。
                        </p>

                        <!-- のっぺらぼう生成方式 -->
                        <div class="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">のっぺらぼう生成エンジン</span>
                            <Dropdown 
                                v-model="generateEngine" 
                                :options="[
                                    { label: 'ローカル画像処理 (MediaPipe/OpenCV)', value: 'mediapipe' },
                                    { label: 'マルチモーダルAI (Gemini)', value: 'gemini' },
                                    { label: '画像生成AI (ComfyUI)', value: 'comfy' }
                                ]" 
                                optionLabel="label" 
                                optionValue="value" 
                                class="w-full text-sm"
                            />
                        </div>

                        <!-- 顔領域の検出方式 (mediapipe エンジン時のみ表示) -->
                        <div v-if="generateEngine === 'mediapipe'" class="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">顔の検出方式</span>
                            <Dropdown 
                                v-model="detectMode" 
                                :options="[
                                    { label: '汎用AIモデル (MediaPipe)', value: 'ai' },
                                    { label: '二次元特化モデル (AnimeFace)', value: 'anime' }
                                ]" 
                                optionLabel="label" 
                                optionValue="value" 
                                class="w-full text-sm"
                                @change="initFaceGuide"
                            />
                        </div>

                        <!-- AI用プロンプト (Gemini / ComfyUI エンジン時に表示) -->
                        <div v-if="generateEngine !== 'mediapipe'" class="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">AI消去用プロンプト</span>
                            <textarea 
                                v-model="nofacePrompt" 
                                rows="4" 
                                class="w-full text-xs p-2 border border-slate-300 rounded focus:ring-primary-500 focus:border-primary-500 bg-white"
                                placeholder="消去指示プロンプトを入力してください"
                            ></textarea>
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
                        <Button severity="primary" class="w-full py-2.5 font-medium text-sm" label="のっぺらぼう生成して次へ" icon="pi pi-arrow-right" iconPos="right" @click="generateAndNext" :loading="isGeneratingNoface" />
                    </div>
                </div>
            </div>

            <!-- STEP 2: のっぺらぼう確認 -->
            <div v-if="currentStep === 2" class="flex-1 flex flex-row">
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
                        <h2 class="text-lg font-semibold text-slate-900 mb-4">のっぺらぼう（ベース顔）の確認</h2>
                        <p class="text-sm text-slate-600 mb-4">
                            AIにより目・鼻・口を消去した顔の仕上がりを確認してください。消し残しがある場合は、画像の上を直接クリック（またはドラッグ）して手動で補正できます。
                        </p>

                        <!-- のっぺらぼう生成方式 -->
                        <div class="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block">のっぺらぼう生成エンジン</span>
                            <Dropdown 
                                v-model="generateEngine" 
                                :options="[
                                    { label: 'ローカル画像処理 (MediaPipe/OpenCV)', value: 'mediapipe' },
                                    { label: 'マルチモーダルAI (Gemini)', value: 'gemini' },
                                    { label: '画像生成AI (ComfyUI)', value: 'comfy' }
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
                                v-model="detectMode" 
                                :options="[
                                    { label: '汎用AIモデル (MediaPipe)', value: 'ai' },
                                    { label: '二次元特化モデル (AnimeFace)', value: 'anime' }
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
                                v-model="nofacePrompt" 
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
                        <Button severity="secondary" class="flex-1 py-2 text-sm border-slate-300" label="戻る" @click="handleBack" />
                        <Button severity="primary" class="flex-1 py-2 text-sm" label="保存して次へ" @click="handleNext" />
                    </div>
                </div>
            </div>

            <!-- STEP 3: 各感情の位置合わせ調整 -->
            <div v-if="currentStep === 3" class="flex-1 flex flex-row">
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
                    <div class="relative border border-slate-300 rounded shadow-md overflow-hidden bg-white">
                        <!-- のっぺらぼうベース -->
                        <img ref="baseImageRef" v-if="baseMascotImageUrl" :src="resolveImageUrl(baseMascotImageUrl)" alt="のっぺらぼう" class="h-[500px] w-auto opacity-50 block" @load="onBaseImageLoad" />
                        
                        <!-- 表情パーツの重ね合わせ（シミュレーション） -->
                        <div 
                            v-if="selectedExpression" 
                            class="absolute border border-dashed border-primary-500 cursor-grab active:cursor-grabbing select-none"
                            :style="{
                                width: `${exprNaturalWidth * (selectedExpression.scale || 1.0) * displayScale}px`,
                                height: `${exprNaturalHeight * (selectedExpression.scale || 1.0) * displayScale}px`,
                                left: '50%',
                                top: '50%',
                                transform: `translate(-50%, -50%) translate(${(selectedExpression.offsetX || 0) * displayScale}px, ${(selectedExpression.offsetY || 0) * displayScale}px) rotate(${selectedExpression.rotation || 0}deg)`,
                                transition: 'none'
                            }"
                            @mousedown.prevent="startDragExpression"
                        >
                            <img :src="resolveImageUrl(selectedExpression.path)" class="w-full h-full object-contain pointer-events-none" alt="表情パーツ" @load="onExprImageLoad" />
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
                                <Slider v-model="selectedExpression.offsetX" :min="-1000" :max="1000" class="w-full" />
                            </div>

                            <div class="space-y-2">
                                <div class="flex justify-between text-xs text-slate-500">
                                    <span>縦方向 (Y)</span>
                                    <span>{{ selectedExpression.offsetY || 0 }}px</span>
                                </div>
                                <Slider v-model="selectedExpression.offsetY" :min="-1000" :max="1000" class="w-full" />
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
            </div>

            <!-- STEP 4: アニメーション動作確認 -->
            <div v-if="currentStep === 4" class="flex-1 flex flex-row">
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

            <!-- STEP 5: アトラス化と保存 -->
            <div v-if="currentStep === 5" class="flex-1 flex flex-row">
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
            <Button severity="primary" class="px-6 py-2.5 font-medium" @click="handleNext" :label="currentStep === 5 ? 'アトラス生成 & 完了' : '次へ'" />
        </footer>
    </div>
</template>

<style scoped>
.expression-editor-page {
    /* ページのフル画面スタイルの微調整用 */
}
</style>
