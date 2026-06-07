<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Button from 'primevue/button';
import { useConfigStore } from '../../store/config';
import { detectFaceFeatures } from '../../skills/expression-alignment/feature-island-detector';
import { detectContentBounds, loadImage } from '../../skills/expression-alignment/content-bounds-detector';

const props = defineProps<{
    visible: boolean;
    imageSrc: string;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'crop', base64: string): void;
}>();

const configStore = useConfigStore();

const resolveImageUrl = (path: string | undefined | null): string => {
    if (!path) return '';
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


const cropX = ref(50);
const cropY = ref(50);
const cropWidth = ref(120);
const cropHeight = ref(120);
const cropImageWidth = ref(0);
const cropImageHeight = ref(0);

const cropContainerRef = ref<HTMLDivElement | null>(null);
const cropImageRef = ref<HTMLImageElement | null>(null);

const handleCropImageLoaded = (event: Event) => {
    const img = event.target as HTMLImageElement;
    cropImageWidth.value = img.naturalWidth;
    cropImageHeight.value = img.naturalHeight;
};

// ドラッグ処理用の変数
let isDraggingCrop = false;
let isResizingCrop = false;
let resizeCorner = ''; // 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
let startDragX = 0;
let startDragY = 0;
let startCropX = 0;
let startCropY = 0;
let startCropWidth = 0;
let startCropHeight = 0;
let startAspectRatio = 1.0;

const onCropMouseDown = (event: MouseEvent) => {
    isDraggingCrop = true;
    isResizingCrop = false;
    startDragX = event.clientX;
    startDragY = event.clientY;
    startCropX = cropX.value;
    startCropY = cropY.value;
    event.preventDefault();
};

const onResizeMouseDown = (event: MouseEvent, corner: string) => {
    isResizingCrop = true;
    isDraggingCrop = false;
    resizeCorner = corner;
    startDragX = event.clientX;
    startDragY = event.clientY;
    startCropX = cropX.value;
    startCropY = cropY.value;
    startCropWidth = cropWidth.value;
    startCropHeight = cropHeight.value;
    startAspectRatio = cropWidth.value / cropHeight.value; // ドラッグ開始時の比率をロック
    event.preventDefault();
    event.stopPropagation(); // 枠自体の移動イベント（onCropMouseDown）を遮断
};

const onCropMouseMove = (event: MouseEvent) => {
    if ((!isDraggingCrop && !isResizingCrop) || !cropContainerRef.value || !cropImageRef.value) return;
    
    const dx = event.clientX - startDragX;
    const dy = event.clientY - startDragY;
    
    const imageRect = cropImageRef.value.getBoundingClientRect();
    
    // スケール比率の算出
    const scaleX = cropImageWidth.value / imageRect.width;
    const scaleY = cropImageHeight.value / imageRect.height;
    
    if (isDraggingCrop) {
        let newX = startCropX + dx * scaleX;
        let newY = startCropY + dy * scaleY;
        
        // 範囲制限 (画像内)
        newX = Math.max(0, Math.min(cropImageWidth.value - cropWidth.value, newX));
        newY = Math.max(0, Math.min(cropImageHeight.value - cropHeight.value, newY));
        
        cropX.value = Math.round(newX);
        cropY.value = Math.round(newY);
    } else if (isResizingCrop) {
        const pixelDx = dx * scaleX;
        const pixelDy = dy * scaleY;
        
        let newWidth = startCropWidth;
        let newHeight = startCropHeight;
        let newX = startCropX;
        let newY = startCropY;
        
        const minSize = 30; // 最小30px
        const isShiftPressed = event.shiftKey; // Shiftキーの押下状態

        if (resizeCorner === 'top') {
            // 上枠: 縦幅のみ修正 (Y座標と高さを変化)
            newHeight = startCropHeight - pixelDy;
            newHeight = Math.max(minSize, Math.min(startCropY + startCropHeight, newHeight));
            newY = startCropY + startCropHeight - newHeight;
        } else if (resizeCorner === 'bottom') {
            // 下枠: 縦幅のみ修正 (高さを変化)
            newHeight = startCropHeight + pixelDy;
            newHeight = Math.max(minSize, Math.min(cropImageHeight.value - startCropY, newHeight));
        } else if (resizeCorner === 'left') {
            // 左枠: 横幅のみ修正 (X座標と幅を変化)
            newWidth = startCropWidth - pixelDx;
            newWidth = Math.max(minSize, Math.min(startCropX + startCropWidth, newWidth));
            newX = startCropX + startCropWidth - newWidth;
        } else if (resizeCorner === 'right') {
            // 右枠: 横幅のみ修正 (幅を変化)
            newWidth = startCropWidth + pixelDx;
            newWidth = Math.max(minSize, Math.min(cropImageWidth.value - startCropX, newWidth));
        } else {
            // 四隅のハンドル（■）: Shiftキー押下で比率ロック、未押下で自由変形
            if (isShiftPressed) {
                // アスペクト比同じで縦横リサイズ
                let change = 0;
                if (resizeCorner === 'bottom-right') {
                    change = Math.max(pixelDx, pixelDy * startAspectRatio);
                } else if (resizeCorner === 'bottom-left') {
                    change = Math.max(-pixelDx, pixelDy * startAspectRatio);
                } else if (resizeCorner === 'top-right') {
                    change = Math.max(pixelDx, -pixelDy * startAspectRatio);
                } else if (resizeCorner === 'top-left') {
                    change = Math.max(-pixelDx, -pixelDy * startAspectRatio);
                }
                
                newWidth = startCropWidth + change;
                newHeight = newWidth / startAspectRatio;
                
                // 制限範囲
                let maxW = cropImageWidth.value;
                let maxH = cropImageHeight.value;
                
                if (resizeCorner === 'bottom-right') {
                    maxW = cropImageWidth.value - startCropX;
                    maxH = cropImageHeight.value - startCropY;
                } else if (resizeCorner === 'bottom-left') {
                    maxW = startCropX + startCropWidth;
                    maxH = cropImageHeight.value - startCropY;
                } else if (resizeCorner === 'top-right') {
                    maxW = cropImageWidth.value - startCropX;
                    maxH = startCropY + startCropHeight;
                } else if (resizeCorner === 'top-left') {
                    maxW = startCropX + startCropWidth;
                    maxH = startCropY + startCropHeight;
                }
                
                const boundWidthByHeight = maxH * startAspectRatio;
                const allowedMaxW = Math.min(maxW, boundWidthByHeight);
                
                newWidth = Math.max(minSize, Math.min(allowedMaxW, newWidth));
                newHeight = newWidth / startAspectRatio;
                
                const actualChangeW = newWidth - startCropWidth;
                
                if (resizeCorner === 'top-left') {
                    newX = startCropX - actualChangeW;
                    newY = startCropY - (newHeight - startCropHeight);
                } else if (resizeCorner === 'top-right') {
                    newY = startCropY - (newHeight - startCropHeight);
                } else if (resizeCorner === 'bottom-left') {
                    newX = startCropX - actualChangeW;
                }
            } else {
                // 自由幅リサイズ (アスペクト比維持なし)
                if (resizeCorner.includes('right')) {
                    newWidth = startCropWidth + pixelDx;
                    newWidth = Math.max(minSize, Math.min(cropImageWidth.value - startCropX, newWidth));
                } else if (resizeCorner.includes('left')) {
                    newWidth = startCropWidth - pixelDx;
                    newWidth = Math.max(minSize, Math.min(startCropX + startCropWidth, newWidth));
                    newX = startCropX + startCropWidth - newWidth;
                }
                
                if (resizeCorner.includes('bottom')) {
                    newHeight = startCropHeight + pixelDy;
                    newHeight = Math.max(minSize, Math.min(cropImageHeight.value - startCropY, newHeight));
                } else if (resizeCorner.includes('top')) {
                    newHeight = startCropHeight - pixelDy;
                    newHeight = Math.max(minSize, Math.min(startCropY + startCropHeight, newHeight));
                    newY = startCropY + startCropHeight - newHeight;
                }
            }
        }
        
        // 安全領域内にある場合のみ代入
        if (newX >= 0 && newY >= 0 && newX + newWidth <= cropImageWidth.value && newY + newHeight <= cropImageHeight.value) {
            cropWidth.value = Math.round(newWidth);
            cropHeight.value = Math.round(newHeight);
            cropX.value = Math.round(newX);
            cropY.value = Math.round(newY);
        }
    }
};

const onCropMouseUp = () => {
    isDraggingCrop = false;
    isResizingCrop = false;
};

const executeCrop = async () => {
    if (!props.imageSrc) return;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = resolveImageUrl(props.imageSrc);
    await new Promise((resolve) => (img.onload = resolve));
    
    const canvas = document.createElement('canvas');
    canvas.width = cropWidth.value;
    canvas.height = cropHeight.value;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.drawImage(
            img,
            cropX.value,
            cropY.value,
            cropWidth.value,
            cropHeight.value,
            0,
            0,
            cropWidth.value,
            cropHeight.value
        );
        
        const croppedBase64 = canvas.toDataURL('image/png');
        emit('crop', croppedBase64);
    }
};

const resetCropArea = () => {
    if (cropImageWidth.value > 0 && cropImageHeight.value > 0) {
        // 画像全体の最大サイズ（正方形アスペクト比）で中央に配置する
        const size = Math.min(cropImageWidth.value, cropImageHeight.value);
        cropWidth.value = size;
        cropHeight.value = size;
        cropX.value = Math.round((cropImageWidth.value - size) / 2);
        cropY.value = Math.round((cropImageHeight.value - size) / 2);
    } else {
        cropX.value = 50;
        cropY.value = 50;
        cropWidth.value = 120;
        cropHeight.value = 120;
    }
};

const executeResetToOriginal = () => {
    if (props.imageSrc) {
        // トリミングを行わずに、元の画像ソース（全体像）そのものを親に適用する
        emit('crop', props.imageSrc);
    }
};

const isAutoDetecting = ref(false);

const handleAutoDetectCropArea = async () => {
    if (!props.imageSrc) return;
    
    isAutoDetecting.value = true;
    try {
        const resolvedUrl = resolveImageUrl(props.imageSrc);
        
        // 目・口などの特徴島を検出
        const features = await detectFaceFeatures(resolvedUrl);
        
        const img = await loadImage(resolvedUrl);
        const imgWidth = img.naturalWidth || img.width;
        const imgHeight = img.naturalHeight || img.height;

        let detectedBox = null;

        if (features.leftEye && features.rightEye) {
            const leftEyeX = features.leftEye.centerX;
            const rightEyeX = features.rightEye.centerX;
            const eyeY = (features.leftEye.centerY + features.rightEye.centerY) / 2;
            
            // 左右の目の距離
            const eyeDist = rightEyeX - leftEyeX;

            // 目の距離を基準とした眉・目・口に絞った最適な矩形の算出比率
            const left = leftEyeX - eyeDist * 0.65;
            const right = rightEyeX + eyeDist * 0.65;
            const top = eyeY - eyeDist * 0.55;      // 目の上方向（眉毛をしっかりカバーする範囲）
            const bottom = eyeY + eyeDist * 0.85;   // 目の下方向（鼻、口、顎をカバーする範囲）

            detectedBox = {
                left: Math.max(0, Math.round(left)),
                right: Math.min(imgWidth, Math.round(right)),
                top: Math.max(0, Math.round(top)),
                bottom: Math.min(imgHeight, Math.round(bottom))
            };
        } else {
            // フォールバック: 不透明領域の上部を切り取る（バストアップや立ち絵を想定）
            const contentBounds = await detectContentBounds(resolvedUrl);
            const contentWidth = contentBounds.box.right - contentBounds.box.left;
            const contentHeight = contentBounds.box.bottom - contentBounds.box.top;

            detectedBox = {
                left: Math.max(0, Math.round(contentBounds.box.left + contentWidth * 0.2)),
                right: Math.min(contentBounds.imageWidth, Math.round(contentBounds.box.right - contentWidth * 0.2)),
                top: Math.max(0, Math.round(contentBounds.box.top + contentHeight * 0.15)),
                bottom: Math.min(contentBounds.imageHeight, Math.round(contentBounds.box.top + contentHeight * 0.48))
            };
        }

        if (detectedBox) {
            cropX.value = detectedBox.left;
            cropY.value = detectedBox.top;
            cropWidth.value = detectedBox.right - detectedBox.left;
            cropHeight.value = detectedBox.bottom - detectedBox.top;
            console.log('[ImageCropModal] 自動顔検出に成功しました:', detectedBox);
        }
    } catch (e) {
        console.error('[ImageCropModal] 自動顔検出に失敗しました:', e);
    } finally {
        isAutoDetecting.value = false;
    }
};

onMounted(() => {
    // マウスアップイベントをグローバルで検知して安全にドラッグを終了する
    window.addEventListener('mouseup', onCropMouseUp);
});
</script>

<template>
    <div v-if="visible" class="custom-modal-overlay crop-modal-overlay" @mousemove="onCropMouseMove" @mouseup="onCropMouseUp">
        <div class="custom-modal-card crop-modal-card">
            <div class="modal-header flex justify-content-between align-items-center pb-2 border-bottom border-gray-200">
                <h2 class="text-base font-bold flex align-items-center gap-2 m-0 text-slate-800">
                    <i class="pi pi-scissors text-purple-500"></i>
                    <span>表情画像のトリミング・切り抜き</span>
                </h2>
                <Button icon="pi pi-times" class="p-button-rounded p-button-text p-button-secondary" style="width: 28px; height: 28px; padding: 0;" @click="emit('close')" />
            </div>

            <div class="modal-body flex-1 flex flex-column gap-3 mt-3 overflow-hidden" style="min-height: 0;">
                <div class="text-xs text-slate-500 font-semibold select-none">
                    紫色の枠をマウスでドラッグして、表情に設定したい四角形の部分を切り出してください。
                </div>
                
                <!-- クロップ作業コンテナ (白基調・薄い影) -->
                <div 
                    ref="cropContainerRef"
                    class="crop-work-container flex-1 border-round bg-slate-50 border-1 border-gray-200 flex align-items-center justify-content-center relative overflow-hidden"
                    style="min-height: 0; box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);"
                >
                    <!-- 画像の実際の表示サイズに完全にフィットする相対位置ラッパー -->
                    <div class="relative flex align-items-center justify-content-center" style="position: relative; max-width: 100%; max-height: 100%; display: flex; align-items: center; justify-content: center;">
                        <img 
                            ref="cropImageRef"
                            :src="resolveImageUrl(imageSrc)" 
                            crossorigin="anonymous"
                            class="crop-base-img select-none"
                            style="max-width: 100%; max-height: 100%; display: block; pointer-events: none; object-fit: contain;"
                            @load="handleCropImageLoaded"
                        />

                        <!-- 切り出し枠 (基準が画像の実表示領域になるため完全に一致します) -->
                        <div 
                            v-if="cropImageWidth > 0 && cropImageRef"
                            class="crop-box absolute border-2 border-purple-500 cursor-move"
                            :style="{
                                width: ((cropWidth / cropImageWidth) * 100) + '%',
                                height: ((cropHeight / cropImageHeight) * 100) + '%',
                                left: ((cropX / cropImageWidth) * 100) + '%',
                                top: ((cropY / cropImageHeight) * 100) + '%',
                                boxShadow: '0 0 0 9999px rgba(255, 255, 255, 0.45)'
                            }"
                            @mousedown="onCropMouseDown"
                        >
                            <!-- 上下の枠（ボーダー検出用バー） -->
                            <div class="crop-edge edge-top" @mousedown.stop="onResizeMouseDown($event, 'top')"></div>
                            <div class="crop-edge edge-bottom" @mousedown.stop="onResizeMouseDown($event, 'bottom')"></div>
                            
                            <!-- 左右の枠（ボーダー検出用バー） -->
                            <div class="crop-edge edge-left" @mousedown.stop="onResizeMouseDown($event, 'left')"></div>
                            <div class="crop-edge edge-right" @mousedown.stop="onResizeMouseDown($event, 'right')"></div>

                            <!-- 四隅のハンドル (■) -->
                            <div class="crop-corner top-left" @mousedown.stop="onResizeMouseDown($event, 'top-left')"></div>
                            <div class="crop-corner top-right" @mousedown.stop="onResizeMouseDown($event, 'top-right')"></div>
                            <div class="crop-corner bottom-left" @mousedown.stop="onResizeMouseDown($event, 'bottom-left')"></div>
                            <div class="crop-corner bottom-right" @mousedown.stop="onResizeMouseDown($event, 'bottom-right')"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal-footer flex justify-content-between gap-2 pt-2 border-top border-gray-200 mt-2">
                <div class="flex gap-2">
                    <Button label="範囲リセット" icon="pi pi-refresh" class="p-button-outlined p-button-secondary p-button-sm px-2" style="font-size: 11px;" @click="resetCropArea" title="切り抜き枠を最大範囲にリセットします" />
                    <Button label="自動切り抜き" icon="pi pi-scissors" class="p-button-outlined p-button-warning p-button-sm px-2" style="font-size: 11px;" :loading="isAutoDetecting" @click="handleAutoDetectCropArea" title="画像から顔部分を自動的に検出して切り抜き枠を設定します" />
                    <Button label="切り抜き解除 (元画像全体)" icon="pi pi-image" class="p-button-outlined p-button-info p-button-sm px-2" style="font-size: 11px;" @click="executeResetToOriginal" title="トリミングをせず、元の全体画像そのものを設定します" />
                </div>
                <div class="flex gap-2">
                    <Button label="キャンセル" icon="pi pi-times" class="p-button-outlined p-button-secondary p-button-sm px-3" style="font-size: 11px;" @click="emit('close')" />
                    <Button label="この範囲で切り抜く" icon="pi pi-check" class="p-button-primary p-button-sm px-4" style="font-size: 11px;" @click="executeCrop" />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 白基調のライトモードオーバーレイ */
.crop-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(241, 245, 249, 0.8) !important; /* ライトグレー半透明 */
    backdrop-filter: blur(12px) !important;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3000;
}

.crop-modal-card {
    background: #ffffff !important;
    border: 1px solid rgba(0, 0, 0, 0.08) !important;
    width: 520px !important;
    height: 520px !important;
    display: flex;
    flex-direction: column;
    padding: 16px !important;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.border-bottom {
    border-bottom: 1px solid #e2e8f0 !important;
}
.border-top {
    border-top: 1px solid #e2e8f0 !important;
}

/* トリミング枠の境界線の検出用バー (見えないが太めの判定領域) */
.crop-edge {
    position: absolute;
    z-index: 5;
}
.crop-edge.edge-top {
    top: -4px;
    left: 4px;
    right: 4px;
    height: 8px;
    cursor: ns-resize;
}
.crop-edge.edge-bottom {
    bottom: -4px;
    left: 4px;
    right: 4px;
    height: 8px;
    cursor: ns-resize;
}
.crop-edge.edge-left {
    left: -4px;
    top: 4px;
    bottom: 4px;
    width: 8px;
    cursor: ew-resize;
}
.crop-edge.edge-right {
    right: -4px;
    top: 4px;
    bottom: 4px;
    width: 8px;
    cursor: ew-resize;
}

/* 四隅のハンドル (■) */
.crop-corner {
    position: absolute;
    width: 10px;
    height: 10px;
    background: #a855f7;
    border: 1px solid white;
    z-index: 10;
}
.crop-corner.top-left { top: -5px; left: -5px; cursor: nwse-resize; }
.crop-corner.top-right { top: -5px; right: -5px; cursor: nesw-resize; }
.crop-corner.bottom-left { bottom: -5px; left: -5px; cursor: nesw-resize; }
.crop-corner.bottom-right { bottom: -5px; right: -5px; cursor: nwse-resize; }
</style>
