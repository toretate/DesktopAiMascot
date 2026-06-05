# 表情エディタのマスコットプレビュー不具合修正 実装計画 (再々改訂・表示不具合の完全解決)

ユーザーからのフィードバック（「表情エディタ上に立ち絵が表示されない」）に基づき、表情エディタの背景プレビューでのデータ同期不良と、アセット描画用CSSスタイルの欠落を解決します。

## ユーザーレビュー要求事項

> [!IMPORTANT]
> - **立ち絵データの動的同期 (computed化)**:
>   `SettingsWindow.vue` 内で定義されている `activeOutfit` および `activePose` を、`ref` から `computed` に変更します。これにより、立ち絵（全身像）が新しく追加されたりメイン立ち絵が切り替わったりした際、表情エディタモーダル内のアバター全身像が自動的かつ確実に最新のものに同期・表示されるようになります。
> - **アセット表示用CSSスタイルの追加**:
>   `SettingsWindow.vue` のスタイルシートに、立ち絵全身像やレイヤー画像を絶対配置で正しく重ね合わせるためのクラス（`preview-full-img`, `preview-base-avatar` 等）を追加します。これにより、画像が表示領域からはみ出したり非表示になったりするレイアウト崩れを防ぎ、プレビューカードの中央に正しく描画させます。

## 未解決の質問

特になし。

## 変更予定内容

### 設定ウィンドウコンポーネント

#### [MODIFY] [SettingsWindow.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/settings/SettingsWindow.vue)

1. **`activeOutfit` / `activePose` を computed に変更し、手動代入を撤廃**
    ```typescript
    // --- 変更前 ---
    const activeOutfit = ref<MascotAsset | null>(null);
    const activePose = ref<MascotAsset | null>(null);

    // --- 変更後 ---
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
    ```
    これに伴い、`selectMascot`、`addOutfitImage`、`setMainOutfit`、`deleteOutfit` 内の `activeOutfit.value = ...` および `activePose.value = ...` への手動代入コードを削除し、データ構造に完全に連動させます。

2. **絶対配置用CSSスタイルの追加**
    `<style scoped>` の末尾に、アセット画像をオーバーレイ表示するためのスタイルを追加します。
    ```css
    /* アセットプレビューレイヤー用スタイル */
    .preview-full-img {
        position: absolute;
        width: 100%;
        height: 100%;
        object-fit: contain;
        z-index: 1;
    }
    .preview-base-avatar {
        position: absolute;
        z-index: 1;
    }
    .preview-layer-img {
        position: absolute;
        object-fit: contain;
        pointer-events: none;
    }
    .preview-layer {
        position: absolute;
    }
    ```

## 検証計画

### 手動検証
1. アプリケーションを起動します (`npm run dev`)。
2. 設定ウィンドウを開き、「マスコット」→「立ち絵（全身像）」タブで、ローカル画像を追加しメイン立ち絵に設定します。
3. **検証項目1 (表情エディタでの全身像表示)**: 「表情アセット」サブタブに戻り、「表情を編集・位置調整」を開きます。
4. 背景に、登録した立ち絵全身像がプレビューコンテナのサイズにフィットして、正しく中央に描画されていることを確認します。
5. 表情パーツスライダー（X/Yオフセット、拡大率）を動かし、全身像の顔の位置に表情が正しく重なるかを確認します。
6. 設定を保存してアプリを再起動し、再度表情エディタを開いた際にも、全身像が正常にロードされて表示されるか検証します。
