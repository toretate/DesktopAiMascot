<script setup lang="ts">
import Button from 'primevue/button';
import { useConfigStore } from '../../../store/config';

interface MascotAsset {
    id: string;
    name: string;
    path: string;
    originalPath?: string;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
    rotation?: number;
    expressions?: MascotAsset[];
}

interface MascotData {
    id: string;
    name: string;
    avatar: string;
    profile: string;
    currentOutfitId?: string;
    currentPoseId?: string;
    defaultExpressionId?: string;
    aiConfig: {
        chat: {
            engine: string;
            model: string;
            temperature: number;
        };
        voice: {
            engine?: string;
            speaker_id?: number;
            style?: string;
            irodori_voice?: string;
            irodori_model?: string;
        };
    };
    assets: {
        outfits: MascotAsset[];
        expressions: MascotAsset[];
        poses: MascotAsset[];
    };
}

const props = defineProps<{
    mascots: MascotData[];
    activeMascotId: string;
    activePose: MascotAsset | null;
    activeOutfit: MascotAsset | null;
    defaultFrontAvatar: MascotAsset | null;
    activePreviewExpression: MascotAsset | null;
    computedListPreviewExpressionStyle: any;
}>();

const emit = defineEmits<{
    (e: 'select-mascot', mascot: MascotData): void;
    (e: 'delete-mascot', id: string): void;
    (e: 'add-mascot'): void;
}>();

const configStore = useConfigStore();

// 画像かどうかの判定
const isImage = (path: string | undefined | null): boolean => {
    if (!path) return false;
    return path.startsWith('data:image/') || 
           path.startsWith('/mascots/') || 
           path.startsWith('http://') || 
           path.startsWith('https://') ||
           /\.(png|jpg|jpeg|webp|gif)$/i.test(path);
};

// アセットURLの解決
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

const getMascotCoverImage = (mascot: MascotData): string => {
    if (!mascot) return '';
    // 1. ポーズ優先
    if (mascot.assets?.poses && mascot.currentPoseId) {
        const pose = mascot.assets.poses.find(p => p.id === mascot.currentPoseId);
        if (pose && isImage(pose.path)) return resolveImageUrl(pose.path);
    }
    // 2. 現在の衣装
    if (mascot.assets?.outfits && mascot.currentOutfitId) {
        const outfit = mascot.assets.outfits.find(o => o.id === mascot.currentOutfitId);
        if (outfit && isImage(outfit.path)) return resolveImageUrl(outfit.path);
    }
    // 3. 最初の衣装
    if (mascot.assets?.outfits && mascot.assets.outfits.length > 0) {
        const outfit = mascot.assets.outfits[0];
        if (outfit && isImage(outfit.path)) return resolveImageUrl(outfit.path);
    }
    // 4. アバター画像
    if (mascot.avatar && isImage(mascot.avatar)) {
        return resolveImageUrl(mascot.avatar);
    }
    return '';
};
</script>

<template>
    <div class="mascot-list-container">
        <div class="mascot-items-scroll-area">
            <div 
                v-for="mascot in mascots" 
                :key="mascot.id"
                class="mascot-item"
                :class="{ active: activeMascotId === mascot.id }"
                @click="emit('select-mascot', mascot)"
            >
                <!-- マスコット削除ボタン -->
                <Button 
                    icon="pi pi-trash" 
                    class="p-button-danger p-button-text p-button-sm mascot-delete-btn" 
                    @click.stop="emit('delete-mascot', mascot.id)"
                    title="マスコットを削除"
                />
                <div class="avatar-container flex align-items-center justify-content-center bg-slate-50 border-round overflow-hidden" style="width: 150px; height: 200px; font-size: 64px; flex-shrink: 0; border: 1px solid rgba(0, 0, 0, 0.04); position: relative;">
                    <!-- 大画面プレビュー（420x560）とアスペクト比を完全に一致させるための 140x186.66px ラッパー -->
                    <div class="mascot-composite-preview relative flex align-items-center justify-content-center" style="width: 140px; height: 186.66px; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                        <!-- 1. ベースキャラクターアバターの優先度表示 -->
                        <template v-if="activeMascotId === mascot.id">
                            <!-- ポーズ画像優先 -->
                            <img v-if="activePose && isImage(activePose.path)" key="active-pose" :src="resolveImageUrl(activePose.path)" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; z-index: 1;" />
                            <!-- 衣装画像優先 -->
                            <img v-else-if="activeOutfit && isImage(activeOutfit.path)" key="active-outfit" :src="resolveImageUrl(activeOutfit.path)" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; z-index: 1;" />
                            <!-- フロント画像優先 -->
                            <img v-else-if="defaultFrontAvatar && isImage(defaultFrontAvatar.path)" key="active-front" :src="resolveImageUrl(defaultFrontAvatar.path)" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; z-index: 1;" />
                            <!-- ベースアバター優先 -->
                            <img v-else-if="mascot.avatar && isImage(mascot.avatar)" key="active-avatar" :src="resolveImageUrl(mascot.avatar)" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; z-index: 1;" />
                            <span v-else key="active-emoji" class="avatar" style="position: absolute; z-index: 1;">{{ mascot.avatar || '🤖' }}</span>
                        </template>
                        <template v-else>
                            <!-- 非アクティブなマスコットは最適なカバー画像を表示 -->
                            <img v-if="getMascotCoverImage(mascot)" key="inactive-cover" :src="getMascotCoverImage(mascot)" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; z-index: 1;" />
                            <span v-else key="inactive-emoji" class="avatar" style="position: absolute; z-index: 1;">{{ mascot.avatar || '🤖' }}</span>
                        </template>
    
                        <!-- 2. 表情画像の重ね合わせプレビュー (アクティブマスコットかつ表情プレビュー中) -->
                        <template v-if="activeMascotId === mascot.id && activePreviewExpression && activePreviewExpression.path">
                            <img 
                                v-if="isImage(activePreviewExpression.path)" 
                                :src="resolveImageUrl(activePreviewExpression.path)" 
                                class="absolute"
                                :style="computedListPreviewExpressionStyle"
                            />
                            <span 
                                v-else 
                                class="absolute font-bold text-lg"
                                :style="computedListPreviewExpressionStyle"
                            >{{ activePreviewExpression.path }}</span>
                        </template>
                    </div>
                </div>
                <div class="info">
                    <span class="name">{{ mascot.name }}</span>
                </div>
            </div>
        </div>
        <!-- マスコット追加ボタン -->
        <Button 
            label="マスコット追加" 
            icon="pi pi-plus" 
            class="p-button-outlined p-button-secondary w-full py-3 mt-2"
            @click="emit('add-mascot')"
        />
    </div>
</template>

<style scoped>
.mascot-list-container {
    display: flex !important;
    flex-direction: column !important;
    width: 240px !important;
    min-width: 240px !important;
    height: 100% !important;
}

.mascot-items-scroll-area {
    display: flex !important;
    flex-direction: column !important;
    gap: 12px !important;
    flex-grow: 1 !important;
    overflow-y: auto !important;
    scrollbar-width: thin;
    padding: 4px !important;
    margin: -4px !important;
}

/* マスコット選択アイテムのスタイル */
.mascot-item {
    position: relative !important;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 8px;
    background: #ffffff;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}
.mascot-item:hover {
    border-color: #cbd5e1;
    background: #f8fafc;
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}
.mascot-delete-btn {
    position: absolute !important;
    top: 8px !important;
    right: 8px !important;
    z-index: 20 !important;
    opacity: 0;
    transition: opacity 0.2s ease;
    background: rgba(255, 255, 255, 0.9) !important;
    border-radius: 50% !important;
    width: 28px !important;
    height: 28px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 !important;
}
.mascot-item:hover .mascot-delete-btn {
    opacity: 1;
}
.mascot-item.active {
    border-color: #a855f7;
    background: #f5f3ff;
    box-shadow: 0 0 0 1px #a855f7, 0 4px 6px -1px rgba(168, 85, 247, 0.1);
}
.mascot-item .name {
    font-weight: bold;
    font-size: 14px;
    color: #1e293b;
}
</style>
