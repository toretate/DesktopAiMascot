import { ref, computed, watch, nextTick } from 'vue';
import { useConfigStore } from '../../../store/config';
import { autoAlignBatch, CONFIDENCE_THRESHOLD } from '../../../skills/expression-alignment/auto-align-v2';
import { isValidImageSource } from '../../../skills/expression-alignment/expression-auto-align';
import { MascotImageSetBuilder } from '../../../mascots/MascotImageSetBuilder';

export interface MascotAsset {
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

export interface MascotData {
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
            engine: string;
            speaker_id: number;
            style: string;
        };
    };
    assets: {
        outfits: MascotAsset[];
        expressions: MascotAsset[];
        poses: MascotAsset[];
    };
}

export function useMascotSettings(
    props: { mascots: MascotData[]; activeMascotId: string; geminiApiKey: string },
    emit: {
        (e: 'update:activeMascotId', id: string): void;
        (e: 'live-update'): void;
        (e: 'save-settings'): void;
        (e: 'add-mascot'): void;
        (e: 'delete-mascot', id: string): void;
    }
) {
    const configStore = useConfigStore();
    const activeMascotSubTab = ref<'profile' | 'outfit' | 'expression'>('expression');
    const showDetailOnMobile = ref(false);
    const mascotPrompts = ref({ identity: '', soul: '', user: '', agents: '', memory: '' });
    const isScanningSprite = ref(false);
    const scannedSprites = ref<{ id: string; name: string; path: string }[]>([]);
    const isAssigningEmotionsModal = ref(false);

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

    // 28個の感情スロットの初期化保証
    const ensure28Expressions = (expressions: any[]): any[] => {
        const defaultEmotions = [
            '通常', '喜び', '怒り', '悲しみ', '驚き',
            '面白がり', '苛立ち', '賛同', '気遣い', '混乱',
            '好奇心', '欲求', '失望', '不賛成', '嫌悪',
            '当惑', '興奮', '恐れ', '感謝', '深い悲しみ',
            '愛情', '緊張', '楽観', '誇り', '気づき',
            '安肚', '後悔', '賞賛' // 原文ママ（※UI等との整合性のために安肚は安肚としておく）
        ];
        // 元の感情リスト名に安肚が存在すれば補正、なければ安眠等のマッピングと合わせる
        // 通常は「安肚」ではなく「安堵」だった可能性があるが、MascotSettings.vueの元の文字列に合わせる
        const rawDefaultEmotions = [
            '通常', '喜び', '怒り', '悲しみ', '驚き',
            '面白がり', '苛立ち', '賛同', '気遣い', '混乱',
            '好奇心', '欲求', '失望', '不賛成', '嫌悪',
            '当惑', '興奮', '恐れ', '感謝', '深い悲しみ',
            '愛情', '緊張', '楽観', '誇り', '気づき',
            '安堵', '後悔', '賞賛'
        ];
        
        const existingMap = new Map<string, any>();
        if (Array.isArray(expressions)) {
            expressions.forEach(e => {
                if (e && e.name) {
                    existingMap.set(e.name.trim(), e);
                }
            });
        }
        
        return rawDefaultEmotions.map(emotion => {
            const existing = existingMap.get(emotion);
            return {
                id: existing?.id || 'expr_' + emotion,
                name: emotion,
                path: existing?.path || '',
                offsetX: existing?.offsetX ?? 0,
                offsetY: existing?.offsetY ?? 0,
                scale: existing?.scale ?? 1.0,
                rotation: existing?.rotation ?? 0
            };
        });
    };

    // 編集・追加対象のワークバッファ
    const editingMascot = ref<MascotData>({
        id: '',
        name: '',
        avatar: '🤖',
        profile: '',
        aiConfig: {
            chat: { engine: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.7 },
            voice: { engine: 'voicevox', speaker_id: 2, style: 'normal' }
        },
        assets: { outfits: [], expressions: [], poses: [] }
    });

    const activeOutfit = computed(() => {
        const mascot = editingMascot.value;
        if (!mascot || !mascot.assets?.outfits) return null;
        return mascot.assets.outfits.find(o => o.id === mascot.currentOutfitId) || mascot.assets.outfits[0] || null;
    });

    const activePose = computed(() => {
        const mascot = editingMascot.value;
        if (!mascot || !mascot.assets?.poses) return null;
        return mascot.assets.poses.find(p => p.id === mascot.currentPoseId) || mascot.assets.poses[0] || null;
    });

    const activeExpression = ref<MascotAsset | null>(null);

    const currentExpressions = computed(() => {
        if (!editingMascot.value) return [];
        return activeOutfit.value?.expressions || editingMascot.value.assets?.expressions || [];
    });

    const editingMascotImageSet = computed(() => {
        const mascot = editingMascot.value;
        if (!mascot) return null;
        
        const assets = [
            ...(mascot.assets?.outfits || []),
            ...currentExpressions.value,
            ...(mascot.assets?.poses || [])
        ];
        
        return MascotImageSetBuilder.CreateFromAssets(mascot.name, assets);
    });

    const defaultFrontAvatar = computed(() => {
        return editingMascotImageSet.value?.getFrontImage() || null;
    });

    const activePreviewExpression = ref<MascotAsset | null>(null);

    const computedListPreviewExpressionStyle = computed(() => {
        const expr = activePreviewExpression.value;
        if (!expr) return {};
        
        const ox = expr.offsetX ?? 0;
        const oy = expr.offsetY ?? 0;
        const sc = expr.scale ?? 1.0;
        const rot = expr.rotation ?? 0;
        
        const scaleFactor = 140 / 420;
        const scaledOx = ox * scaleFactor;
        const scaledOy = oy * scaleFactor;
        const baseWidthHeight = 140 * scaleFactor;
        
        return {
            position: 'absolute' as const,
            width: `${baseWidthHeight}px`,
            height: `${baseWidthHeight}px`,
            objectFit: 'contain' as const,
            pointerEvents: 'none' as const,
            transform: `translate(${scaledOx}px, ${scaledOy}px) scale(${sc}) rotate(${rot}deg)`,
            zIndex: 10
        };
    });

    const loadMascotPrompts = async () => {
        if (window.electronAPI && editingMascot.value && editingMascot.value.id) {
            try {
                const data = await window.electronAPI.getMascotPrompts(editingMascot.value.id);
                mascotPrompts.value = data;
            } catch (e) {
                console.error('Failed to load mascot prompts in settings:', e);
            }
        }
    };

    const updateMascotPreview = (overrides: { expressionId?: string; outfitId?: string; poseId?: string } = {}) => {
        if (window.electronAPI && window.electronAPI.previewMascotState) {
            const currentExpr = (overrides.expressionId !== undefined)
                ? currentExpressions.value.find(e => e.id === overrides.expressionId)
                : activePreviewExpression.value;
            
            window.electronAPI.previewMascotState({
                expressionId: currentExpr?.id || editingMascot.value.defaultExpressionId,
                expressionOffsetX: currentExpr?.offsetX ?? 0,
                expressionOffsetY: currentExpr?.offsetY ?? 0,
                expressionScale: currentExpr?.scale ?? 1.0,
                expressionRotation: currentExpr?.rotation ?? 0,
                outfitId: overrides.outfitId !== undefined ? overrides.outfitId : editingMascot.value.currentOutfitId,
                poseId: overrides.poseId !== undefined ? overrides.poseId : editingMascot.value.currentPoseId
            });
        }
    };

    const selectExpressionForPreview = (expr: MascotAsset) => {
        activePreviewExpression.value = expr;
        updateMascotPreview({ expressionId: expr.id });
    };

    const selectMascot = (mascot: MascotData) => {
        if (editingMascot.value && editingMascot.value.id) {
            const idx = configStore.mascots.findIndex(m => m.id === editingMascot.value.id);
            if (idx !== -1) {
                configStore.mascots.splice(idx, 1, JSON.parse(JSON.stringify(editingMascot.value)));
            }
        }
        emit('update:activeMascotId', mascot.id);
        editingMascot.value = JSON.parse(JSON.stringify(mascot));
        const currentMascotOutfit = mascot.assets?.outfits?.find((o: any) => o.id === mascot.currentOutfitId) || mascot.assets?.outfits?.[0] || null;
        const currentMascotExpressions = currentMascotOutfit?.expressions || mascot.assets?.expressions || [];
        activeExpression.value = currentMascotExpressions.find((e: any) => e.name === '通常') || currentMascotExpressions[0] || null;
        activePreviewExpression.value = activeExpression.value;
        
        updateMascotPreview();
        loadMascotPrompts();

        emit('save-settings');
        showDetailOnMobile.value = true;
    };

    const initEditingMascot = () => {
        const mascotsList = configStore.mascots || props.mascots;
        if (mascotsList && mascotsList.length > 0) {
            const active = mascotsList.find(m => m && m.id === props.activeMascotId) || mascotsList[0];
            if (!active) {
                return;
            }
            try {
                editingMascot.value = JSON.parse(JSON.stringify(active));
            } catch (e) {
                console.error('[useMascotSettings] Failed to parse active mascot:', e);
                return;
            }
            
            if (editingMascot.value && editingMascot.value.assets) {
                editingMascot.value.assets.expressions = ensure28Expressions(editingMascot.value.assets.expressions || []);
                if (Array.isArray(editingMascot.value.assets.outfits)) {
                    editingMascot.value.assets.outfits.forEach((o: any) => {
                        o.expressions = ensure28Expressions(o.expressions || []);
                    });
                }
            }
            
            const currentMascotOutfit = editingMascot.value.assets?.outfits?.find((o: any) => o && o.id === editingMascot.value.currentOutfitId) || editingMascot.value.assets?.outfits?.[0] || null;
            const currentMascotExpressions = currentMascotOutfit?.expressions || editingMascot.value.assets?.expressions || [];
            activeExpression.value = currentMascotExpressions.find((e: any) => e && e.name === '通常') || currentMascotExpressions[0] || null;
            activePreviewExpression.value = activeExpression.value;
            loadMascotPrompts();
        }
    };

    const syncAndSave = async () => {
        const idx = configStore.mascots.findIndex(m => m.id === editingMascot.value.id);
        if (idx !== -1) {
            configStore.mascots.splice(idx, 1, JSON.parse(JSON.stringify(editingMascot.value)));
            configStore.configVersion++;
            emit('live-update');
        }
    };

    const setDefaultExpression = (id: string) => {
        editingMascot.value.defaultExpressionId = id;
        updateMascotPreview();
        syncAndSave();
        emit('save-settings');
    };

    // AI 一括位置合わせ
    const isBatchAligningV2 = ref(false);
    const batchAlignV2Progress = ref('');

    const handleBatchAlignV2 = async () => {
        if (!editingMascot.value) return;

        const currentOutfit = editingMascot.value.assets?.outfits?.find(
            (o: any) => o.id === editingMascot.value.currentOutfitId
        ) || editingMascot.value.assets?.outfits?.[0] || null;

        const baseImagePath = (() => {
            if (currentOutfit && isImage(currentOutfit.path)) return resolveImageUrl(currentOutfit.path);
            if (editingMascot.value.avatar && isImage(editingMascot.value.avatar)) return resolveImageUrl(editingMascot.value.avatar);
            return '';
        })();

        if (!isValidImageSource(baseImagePath)) {
            console.warn('[useMascotSettings] ベース画像が見つからないため一括 AI 位置合わせをスキップします');
            return;
        }

        const expressions = currentOutfit?.expressions || editingMascot.value.assets?.expressions || [];
        const targets = expressions
            .filter((e: any) => e.path && isImage(e.path))
            .map((e: any) => ({
                id: e.id as string,
                url: resolveImageUrl(e.path) as string,
                isNeutral: e.name === '通常',
            }));

        if (targets.length === 0) {
            console.warn('[useMascotSettings] 位置合わせ対象の表情が見つかりません');
            return;
        }

        isBatchAligningV2.value = true;
        batchAlignV2Progress.value = `処理中 0/${targets.length}`;

        try {
            const results = await autoAlignBatch(baseImagePath, targets);
            let applied = 0;
            let lowConfCount = 0;

            for (const expr of expressions) {
                const r = results.get(expr.id);
                if (!r) continue;
                expr.offsetX = r.params.offsetX;
                expr.offsetY = r.params.offsetY;
                expr.scale = r.params.scale;
                expr.rotation = r.params.rotation;
                applied++;
                if (r.confidence < CONFIDENCE_THRESHOLD) lowConfCount++;
            }

            await syncAndSave();

            if (lowConfCount > 0) {
                batchAlignV2Progress.value = `完了: ${applied}件適用（${lowConfCount}件低信頼度）`;
            } else {
                batchAlignV2Progress.value = `完了: ${applied}件適用`;
            }
        } catch (e) {
            console.error('[useMascotSettings] AI 一括位置合わせに失敗しました:', e);
            batchAlignV2Progress.value = 'エラーが発生しました';
        } finally {
            isBatchAligningV2.value = false;
            setTimeout(() => { batchAlignV2Progress.value = ''; }, 4000);
        }
    };

    const importFromSpriteSheet = async (importData?: string | { imagePath: string; importId: string }) => {
        if (!window.electronAPI) return;
        
        let imagePath = '';
        let importId = '';
        let isBase64 = false;
        let originalSource = '';
        
        if (importData) {
            if (typeof importData === 'string') {
                imagePath = importData;
                originalSource = importData;
                isBase64 = imagePath.startsWith('data:image/');
                const match = imagePath.match(/\/expressions\/working\/([^\/]+)\//);
                importId = match ? match[1] : 'sheet_' + Date.now();
            } else {
                imagePath = importData.imagePath;
                originalSource = importData.imagePath;
                importId = importData.importId;
                isBase64 = imagePath.startsWith('data:image/');
            }
        } else {
            const result = await window.electronAPI.selectLocalImage();
            if (!result || !result.success) return;
            imagePath = result.path;
            originalSource = result.path;
            isBase64 = imagePath.startsWith('data:image/');
            importId = 'sheet_' + Date.now();
        }
        
        isScanningSprite.value = true;
        
        try {
            const configData = await window.electronAPI.getAppConfig();
            const apiKey = configData.googleAiStudioApiKey || props.geminiApiKey;
            if (!apiKey) {
                alert('Google AI Studio APIキーを設定してください。');
                isScanningSprite.value = false;
                return;
            }
            
            if (isBase64 && editingMascot.value?.id) {
                try {
                    const sheetFilename = `expressions/working/${importId}/spritesheet_${importId}.png`;
                    const saveResult = await window.electronAPI.saveMascotImage(
                        editingMascot.value.id,
                        sheetFilename,
                        imagePath
                    );
                    if (saveResult.success && saveResult.path) {
                        imagePath = saveResult.path;
                    }
                } catch (saveErr) {
                    console.warn('[useMascotSettings] スプライトシート全体の保存に失敗しました:', saveErr);
                }
            }
            
            const scanResults = await window.electronAPI.analyzeSpriteSheet(imagePath, apiKey);
            if (scanResults.error) {
                throw new Error(scanResults.error);
            }
            
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = originalSource.startsWith('data:image/') ? originalSource : resolveImageUrl(originalSource);
            await new Promise((resolve) => (img.onload = resolve));
            
            scannedSprites.value = [];
            
            const emotionTranslationMap: Record<string, string> = {
                admiration: '賞賛', amusement: '面白がり', anger: '怒り', annoyance: '苛立ち', approval: '賛同',
                caring: '気遣い', confusion: '混乱', curiosity: '好奇心', desire: '欲求', disappointment: '失望',
                disapproval: '不賛成', disgust: '嫌悪', embarrassment: '当惑', excitement: '興奮', fear: '恐れ',
                gratitude: '感謝', grief: '深い悲しみ', joy: '喜び', love: '愛情', nervousness: '緊張',
                optimism: '楽観', pride: '誇り', realization: '気づき', relief: '安堵', remorse: '後悔',
                sadness: '悲しみ', surprise: '驚き', neutral: '通常'
            };
            
            for (const res of scanResults) {
                const box = res.box_2d || res.box || res.coordinates;
                if (!box || !Array.isArray(box) || box.length < 4) continue;
                const [ymin, xmin, ymax, xmax] = box;
                const label = res.label || res.emotion;
                if (!label) continue;
                
                const canvas = document.createElement('canvas');
                const width = ((xmax - xmin) * img.width) / 1000;
                const height = ((ymax - ymin) * img.height) / 1000;
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(
                        img,
                        (xmin * img.width) / 1000,
                        (ymin * img.height) / 1000,
                        width,
                        height,
                        0,
                        0,
                        width,
                        height
                    );
                    
                    const croppedBase64 = canvas.toDataURL('image/png');
                    const rawLabel = label.trim();
                    const translatedLabel = emotionTranslationMap[rawLabel.toLowerCase()] || rawLabel;
                    
                    let finalCroppedPath = croppedBase64;
                    if (window.electronAPI?.saveMascotImage && editingMascot.value?.id) {
                        try {
                            const sanitizedLabel = translatedLabel.replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '_');
                            const filename = `expressions/working/${importId}/expr_${sanitizedLabel}.png`;
                            const saveResult = await window.electronAPI.saveMascotImage(
                                editingMascot.value.id,
                                filename,
                                croppedBase64
                            );
                            if (saveResult.success && saveResult.path) {
                                finalCroppedPath = saveResult.path;
                            }
                        } catch (saveErr) {
                            console.warn(`[useMascotSettings] 表情 ${translatedLabel} の保存に失敗しました:`, saveErr);
                        }
                    }
                    
                    const currentMascotExpressions = activeOutfit.value?.expressions || editingMascot.value.assets?.expressions || [];
                    const targetSlot = currentMascotExpressions.find(
                        (e: any) => e.name.toLowerCase() === translatedLabel.toLowerCase()
                    );
                    if (targetSlot) {
                        targetSlot.path = finalCroppedPath;
                        targetSlot.originalPath = imagePath;
                    }
                    
                    scannedSprites.value.push({
                        id: 'sprite_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        name: translatedLabel,
                        path: finalCroppedPath
                    });
                }
            }
            
            alert(`${scanResults.length}個の表情を検出・スロットへ自動割り当てしました。`);
            isAssigningEmotionsModal.value = true;
        } catch (e: any) {
            alert('解析に失敗しました: ' + e.message);
        } finally {
            isScanningSprite.value = false;
        }
    };

    const closeAssigningEmotionsModal = async () => {
        isAssigningEmotionsModal.value = false;
        const currentMascotExpressions = activeOutfit.value?.expressions || editingMascot.value.assets.expressions || [];
        activeExpression.value = currentMascotExpressions.find((e: any) => e.name === '通常') || currentMascotExpressions[0] || null;
        
        const idx = configStore.mascots.findIndex(m => m.id === editingMascot.value.id);
        if (idx !== -1) {
            configStore.mascots[idx] = JSON.parse(JSON.stringify(editingMascot.value));
            emit('save-settings');
        }
    };

    return {
        activeMascotSubTab,
        showDetailOnMobile,
        mascotPrompts,
        editingMascot,
        activeOutfit,
        activePose,
        activeExpression,
        currentExpressions,
        defaultFrontAvatar,
        activePreviewExpression,
        computedListPreviewExpressionStyle,
        isBatchAligningV2,
        batchAlignV2Progress,
        isImage,
        resolveImageUrl,
        ensure28Expressions,
        loadMascotPrompts,
        updateMascotPreview,
        selectExpressionForPreview,
        selectMascot,
        initEditingMascot,
        syncAndSave,
        setDefaultExpression,
        handleBatchAlignV2,
        isScanningSprite,
        scannedSprites,
        isAssigningEmotionsModal,
        importFromSpriteSheet,
        closeAssigningEmotionsModal
    };
}
