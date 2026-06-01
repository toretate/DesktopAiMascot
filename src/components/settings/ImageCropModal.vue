<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Button from 'primevue/button';

const props = defineProps<{
    visible: boolean;
    imageSrc: string;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'crop', base64: string): void;
}>();

const cropX = ref(50);
const cropY = ref(50);
const cropSize = ref(120);
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
let resizeCorner = ''; // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
let startDragX = 0;
let startDragY = 0;
let startCropX = 0;
let startCropY = 0;
let startCropSize = 0;

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
    startCropSize = cropSize.value;
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
        newX = Math.max(0, Math.min(cropImageWidth.value - cropSize.value, newX));
        newY = Math.max(0, Math.min(cropImageHeight.value - cropSize.value, newY));
        
        cropX.value = Math.round(newX);
        cropY.value = Math.round(newY);
    } else if (isResizingCrop) {
        // リサイズ処理 (1:1正方形アスペクト比を完璧に維持)
        const pixelDx = dx * scaleX;
        const pixelDy = dy * scaleY;
        let change = 0;
        
        if (resizeCorner === 'bottom-right') {
            change = Math.max(pixelDx, pixelDy);
        } else if (resizeCorner === 'bottom-left') {
            change = Math.max(-pixelDx, pixelDy);
        } else if (resizeCorner === 'top-right') {
            change = Math.max(pixelDx, -pixelDy);
        } else if (resizeCorner === 'top-left') {
            change = Math.max(-pixelDx, -pixelDy);
        }
        
        let newSize = startCropSize + change;
        
        // 制限範囲の決定
        const minSize = 40; // 最小40px
        let maxSize = cropImageWidth.value;
        
        if (resizeCorner === 'bottom-right') {
            maxSize = Math.min(cropImageWidth.value - startCropX, cropImageHeight.value - startCropY);
        } else if (resizeCorner === 'bottom-left') {
            maxSize = Math.min(startCropX + startCropSize, cropImageHeight.value - startCropY);
        } else if (resizeCorner === 'top-right') {
            maxSize = Math.min(cropImageWidth.value - startCropX, startCropY + startCropSize);
        } else if (resizeCorner === 'top-left') {
            maxSize = Math.min(startCropX + startCropSize, startCropY + startCropSize);
        }
        
        newSize = Math.max(minSize, Math.min(maxSize, newSize));
        
        let newX = startCropX;
        let newY = startCropY;
        const actualChange = newSize - startCropSize;
        
        if (resizeCorner === 'top-left') {
            newX = startCropX - actualChange;
            newY = startCropY - actualChange;
        } else if (resizeCorner === 'top-right') {
            newY = startCropY - actualChange;
        } else if (resizeCorner === 'bottom-left') {
            newX = startCropX - actualChange;
        }
        
        // 安全領域内にある場合のみ代入
        if (newX >= 0 && newY >= 0 && newX + newSize <= cropImageWidth.value && newY + newSize <= cropImageHeight.value) {
            cropSize.value = Math.round(newSize);
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
    img.src = props.imageSrc;
    await new Promise((resolve) => (img.onload = resolve));
    
    const canvas = document.createElement('canvas');
    canvas.width = cropSize.value;
    canvas.height = cropSize.value;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.drawImage(
            img,
            cropX.value,
            cropY.value,
            cropSize.value,
            cropSize.value,
            0,
            0,
            cropSize.value,
            cropSize.value
        );
        
        const croppedBase64 = canvas.toDataURL('image/png');
        emit('crop', croppedBase64);
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
                    <img 
                        ref="cropImageRef"
                        :src="imageSrc" 
                        class="crop-base-img max-width-full max-height-full object-contain select-none"
                        style="max-width: 100%; max-height: 100%; pointer-events: none;"
                        @load="handleCropImageLoaded"
                    />

                    <!-- 切り出し枠 (紫のアウトラインと明るい内側) -->
                    <div 
                        v-if="cropImageWidth > 0 && cropImageRef"
                        class="crop-box absolute border-2 border-purple-500 cursor-move"
                        :style="{
                            width: ((cropSize / cropImageWidth) * 100) + '%',
                            height: ((cropSize / cropImageHeight) * 100) + '%',
                            left: ((cropX / cropImageWidth) * 100) + '%',
                            top: ((cropY / cropImageHeight) * 100) + '%',
                            boxShadow: '0 0 0 9999px rgba(255, 255, 255, 0.45)'
                        }"
                        @mousedown="onCropMouseDown"
                    >
                        <div class="crop-corner top-left" @mousedown.stop="onResizeMouseDown($event, 'top-left')"></div>
                        <div class="crop-corner top-right" @mousedown.stop="onResizeMouseDown($event, 'top-right')"></div>
                        <div class="crop-corner bottom-left" @mousedown.stop="onResizeMouseDown($event, 'bottom-left')"></div>
                        <div class="crop-corner bottom-right" @mousedown.stop="onResizeMouseDown($event, 'bottom-right')"></div>
                    </div>
                </div>
            </div>

            <div class="modal-footer flex justify-content-end gap-2 pt-2 border-top border-gray-200 mt-2">
                <Button label="キャンセル" icon="pi pi-times" class="p-button-outlined p-button-secondary p-button-sm px-3" @click="emit('close')" />
                <Button label="この範囲で切り抜く" icon="pi pi-check" class="p-button-primary p-button-sm px-4" @click="executeCrop" />
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

.crop-corner {
    position: absolute;
    width: 8px;
    height: 8px;
    background: #a855f7;
    border: 1px solid white;
}
.crop-corner.top-left { top: -4px; left: -4px; cursor: nwse-resize; }
.crop-corner.top-right { top: -4px; right: -4px; cursor: nesw-resize; }
.crop-corner.bottom-left { bottom: -4px; left: -4px; cursor: nesw-resize; }
.crop-corner.bottom-right { bottom: -4px; right: -4px; cursor: nwse-resize; }
</style>
