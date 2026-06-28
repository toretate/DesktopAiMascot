<script setup lang="ts">
import { ref, watch } from 'vue';
import { extractImageParameters } from '../../utils/png-metadata';

const props = defineProps<{
    url: string | null;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'use-i2i', url: string): void;
}>();

const imageParametersText = ref('');
const showInfoPanel = ref(false);
const copied = ref(false);

const openDownloadsFolder = () => {
    if (window.electronAPI && window.electronAPI.openDownloadsFolder) {
        window.electronAPI.openDownloadsFolder();
    }
};

const copyParameters = async () => {
    if (!imageParametersText.value) return;
    try {
        await navigator.clipboard.writeText(imageParametersText.value);
        copied.value = true;
        setTimeout(() => {
            copied.value = false;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy text:', err);
    }
};

const handleClose = () => {
    emit('close');
};

watch(() => props.url, (newUrl) => {
    if (!newUrl) {
        imageParametersText.value = '';
        showInfoPanel.value = false;
        copied.value = false;
        return;
    }

    showInfoPanel.value = false;
    copied.value = false;

    if (window.electronAPI && window.electronAPI.logDebug) {
        window.electronAPI.logDebug(`openImageModal URL length: ${newUrl.length}, startsWithData: ${newUrl.startsWith('data:')}`);
        try {
            const parts = newUrl.split(',');
            const base64 = (parts[1] || '').replace(/\s/g, '');
            const bin = atob(base64.substring(0, 100));
            const header = [];
            for (let i = 0; i < Math.min(bin.length, 8); i++) {
                header.push(bin.charCodeAt(i).toString(16).padStart(2, '0').toUpperCase());
            }
            window.electronAPI.logDebug(`Image Header: ${header.join(' ')}`);
        } catch (e: any) {
            window.electronAPI.logDebug(`Failed to read header: ${e.message}`);
        }
    }

    try {
        const params = extractImageParameters(newUrl);
        imageParametersText.value = params;

        if (window.electronAPI && window.electronAPI.logDebug) {
            window.electronAPI.logDebug(`Parsed parameters length: ${params?.length}`);
            if (params) {
                window.electronAPI.logDebug(`Parsed parameters text:\n${params}`);
            }
        }
    } catch (e: any) {
        if (window.electronAPI && window.electronAPI.logDebug) {
            window.electronAPI.logDebug(`Failed to extract parameters: ${e.message}`);
        }
    }
}, { immediate: true });
</script>

<template>
    <div v-if="url" class="image-modal" @click="handleClose">
        <div class="image-modal-content" @click.stop>
            <img :src="url" class="full-image" @click="handleClose" />

            <div class="modal-action-bar">
                <button type="button" class="modal-action-btn i2i-btn" @click="emit('use-i2i', url); handleClose()" title="この画像を画像編集 (i2i) の元画像に設定">
                    <i class="pi pi-pencil"></i> この画像を i2i 元画像に設定
                </button>

                <button v-if="imageParametersText" type="button" class="modal-action-btn info-btn" :class="{ 'active-info': showInfoPanel }" @click="showInfoPanel = !showInfoPanel" title="生成パラメータを表示">
                    <i class="pi pi-info-circle"></i> 生成パラメータ
                </button>

                <button type="button" class="modal-action-btn folder-btn" @click="openDownloadsFolder" title="画像の保存先（ダウンロード）フォルダを開く">
                    <i class="pi pi-folder-open"></i> 保存先を開く
                </button>
            </div>

            <!-- パラメータ詳細表示パネル -->
            <div v-if="showInfoPanel && imageParametersText" class="info-panel-overlay">
                <div class="info-panel-header">
                    <span class="info-panel-title"><i class="pi pi-info-circle"></i> 生成パラメータ詳細</span>
                    <div class="info-panel-actions">
                        <button type="button" class="panel-icon-btn" @click="copyParameters" title="パラメータをコピー">
                            <i class="pi" :class="copied ? 'pi-check text-green-500' : 'pi-copy'"></i>
                        </button>
                        <button type="button" class="panel-icon-btn" @click="showInfoPanel = false" title="閉じる">
                            <i class="pi pi-times"></i>
                        </button>
                    </div>
                </div>
                <div class="info-panel-body">
                    <pre class="parameters-pre">{{ imageParametersText }}</pre>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 画像拡大モーダル */
.image-modal {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    cursor: zoom-out;
    animation: fadeIn 0.2s ease;
}

.image-modal-content {
    position: relative;
    width: 100%;
    height: 100%;
    max-width: 90%;
    max-height: 90%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.full-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.modal-action-bar {
    position: absolute;
    bottom: 20px;
    display: flex;
    gap: 12px;
    z-index: 10000;
}

.modal-action-btn {
    border: none;
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
    color: white;
}

.modal-action-btn.i2i-btn {
    background: #8b5cf6;
}

.modal-action-btn.i2i-btn:hover {
    background: #7c3aed;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(124, 58, 237, 0.5);
}

.modal-action-btn.info-btn {
    background: rgba(30, 41, 59, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(4px);
}

.modal-action-btn.info-btn:hover {
    background: rgba(30, 41, 59, 1);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
}

.modal-action-btn.info-btn.active-info {
    background: #0ea5e9;
    border-color: #38bdf8;
    box-shadow: 0 0 12px rgba(14, 165, 233, 0.5);
}

.modal-action-btn.folder-btn {
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(4px);
}

.modal-action-btn.folder-btn:hover {
    background: rgba(15, 23, 42, 0.9);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
}

/* ---- パラメータ詳細表示パネル ---- */
.info-panel-overlay {
    position: absolute;
    top: 5%;
    left: 5%;
    width: 90%;
    height: 90%;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    z-index: 10001;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    animation: fadeIn 0.15s ease;
}

.info-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.info-panel-title {
    font-size: 13px;
    font-weight: 600;
    color: #f1f5f9;
    display: flex;
    align-items: center;
    gap: 6px;
}

.info-panel-actions {
    display: flex;
    gap: 8px;
}

.panel-icon-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 14px;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}

.panel-icon-btn:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.08);
}

.info-panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
}

.parameters-pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    font-family: Consolas, Monaco, monospace;
    font-size: 11px;
    line-height: 1.6;
    color: #cbd5e1;
}

.text-green-500 {
    color: #10b981 !important;
}
</style>
