# 実装計画: チャットウィンドウの背景設定追加

## 1. 設定ストアの拡張 (`ui/src/store/config.ts`)

### 1.1. インターフェースの拡張
`AppConfig` インターフェースに以下のプロパティを追加します。
```typescript
    chatBackgroundImage: string;
    chatBackgroundImageOpacity: number;
    chatBackgroundImageFit: 'cover' | 'contain' | 'fill' | 'tile';
```

### 1.2. Stateの追加
```typescript
    const chatBackgroundImage = ref('');
    const chatBackgroundImageOpacity = ref(1.0);
    const chatBackgroundImageFit = ref<'cover' | 'contain' | 'fill' | 'tile'>('cover');
```

### 1.3. `loadConfig` 内での初期化
`configData` が存在する場合：
```typescript
            chatBackgroundImage.value = configData.chatBackgroundImage || '';
            chatBackgroundImageOpacity.value = configData.chatBackgroundImageOpacity !== undefined ? Number(configData.chatBackgroundImageOpacity) : 1.0;
            chatBackgroundImageFit.value = configData.chatBackgroundImageFit || 'cover';
```

localStorageフォールバック時：
```typescript
            chatBackgroundImage.value = localStorage.getItem('chatBackgroundImage') || '';
            const bgOpacity = localStorage.getItem('chatBackgroundImageOpacity');
            chatBackgroundImageOpacity.value = bgOpacity ? parseFloat(bgOpacity) : 1.0;
            chatBackgroundImageFit.value = (localStorage.getItem('chatBackgroundImageFit') as any) || 'cover';
```

### 1.4. `saveConfig` 内での保存
```typescript
            chatBackgroundImage: chatBackgroundImage.value,
            chatBackgroundImageOpacity: Number(chatBackgroundImageOpacity.value),
            chatBackgroundImageFit: chatBackgroundImageFit.value,
```

localStorageへの保存：
```typescript
        localStorage.setItem('chatBackgroundImage', chatBackgroundImage.value);
        localStorage.setItem('chatBackgroundImageOpacity', chatBackgroundImageOpacity.value.toString());
        localStorage.setItem('chatBackgroundImageFit', chatBackgroundImageFit.value);
```

### 1.5. `updateConfig` 内での更新
```typescript
        if (newConfig.chatBackgroundImage !== undefined) chatBackgroundImage.value = newConfig.chatBackgroundImage;
        if (newConfig.chatBackgroundImageOpacity !== undefined) chatBackgroundImageOpacity.value = Number(newConfig.chatBackgroundImageOpacity);
        if (newConfig.chatBackgroundImageFit !== undefined) chatBackgroundImageFit.value = newConfig.chatBackgroundImageFit as any;
```

---

## 2. 設定画面UIの拡張 (`ui/src/components/settings/WindowSettingsPanel.vue`)

### 2.1. 新設定値のインポート
`storeToRefs` から以下を切り出します。
- `chatBackgroundImage`
- `chatBackgroundImageOpacity`
- `chatBackgroundImageFit`

### 2.2. フィット方法の選択肢
```typescript
const chatBackgroundImageFitOptions = ref([
    { name: 'カバー (全体に広げる - アスペクト比維持)', value: 'cover' },
    { name: '全体表示 (全体が収まるように表示)', value: 'contain' },
    { name: '引き延ばし (枠に合わせて伸縮)', value: 'fill' },
    { name: '並べて表示 (タイル状に繰り返す)', value: 'tile' }
]);
```

### 2.3. 画像選択ハンドラ
```typescript
const selectBackgroundImage = async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.selectLocalImage();
    if (result && result.success) {
        chatBackgroundImage.value = result.path;
    }
};

const clearBackgroundImage = () => {
    chatBackgroundImage.value = '';
};
```

### 2.4. 左右 2Pane レイアウトとチャットプレビューの追加
「チャットウィンドウ設定」の下部を左右2ペインのグリッド構造に変更します。
- **左ペイン (各種設定)**: 背景色、不透明度、背景画像、画像不透明度、フィット方法、枠、最前面表示、送信キー、フォントなどの各種入力コントロールを配置。
- **右ペイン (プレビュー)**: 設定項目がリアルタイムに反映されるチャット画面のミニモックアップ（吹き出しメッセージとヘッダー、フッターを含む）を配置。

#### プレビュー用 computed スタイルの追加
`WindowSettingsPanel.vue` 内に、プレビューに適用するための dynamic style を算出する computed プロパティを追加します。
- `getPreviewRgbaBackground`: 設定された `chatBackgroundColor` と `chatOpacity` から RGBA 文字列を算出。
- `getPreviewBorderStyle`: 設定された `chatBorderShow`、`chatBorderColor`、`chatBorderWidth` から border 指定文字列を算出。
- `chatPreviewBackgroundStyle`: 設定された背景画像、不透明度、フィット方法からスタイルオブジェクトを算出（`ChatPanel.vue` のものと同様）。

#### HTML テンプレートの構築
```html
<div class="grid mt-2">
    <!-- 左ペイン: コントロール -->
    <div class="col-12 lg:col-7 flex flex-column gap-3">
        <!-- 各種コントロール (背景色、不透明度、背景画像、枠、フォントなど) -->
    </div>
    <!-- 右ペイン: プレビュー -->
    <div class="col-12 lg:col-5 flex flex-column justify-content-center align-items-center">
        <label class="font-medium mb-2 align-self-start">プレビュー</label>
        <div class="chat-preview-container" :style="{ fontFamily: chatFontFamily, border: getPreviewBorderStyle }">
            <div class="chat-preview-background" :style="chatPreviewBackgroundStyle"></div>
            ...
        </div>
    </div>
</div>
```
※ PrimeFlex を使用するため、レスポンシブ（モバイル時は縦並び、PC大画面 `lg` 時は左右 2Pane 分割）に対応した上品な配置にします。

---

## 3. チャット画面への反映 (`ui/src/components/ChatPanel.vue`)

### 3.1. ストアデータのインポート
`storeToRefs` から以下をインポート：
- `chatBackgroundImage`
- `chatBackgroundImageOpacity`
- `chatBackgroundImageFit`

### 3.2. スタイルの生成
`chatBackgroundStyle` という `computed` プロパティを定義：
```typescript
const chatBackgroundStyle = computed(() => {
    const styles: Record<string, any> = {
        backgroundColor: getRgbaBackground.value,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: -1
    };
    if (chatBackgroundImage.value) {
        styles.backgroundImage = `url(${chatBackgroundImage.value})`;
        styles.opacity = chatBackgroundImageOpacity.value;
        
        if (chatBackgroundImageFit.value === 'cover') {
            styles.backgroundSize = 'cover';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (chatBackgroundImageFit.value === 'contain') {
            styles.backgroundSize = 'contain';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (chatBackgroundImageFit.value === 'fill') {
            styles.backgroundSize = '100% 100%';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (chatBackgroundImageFit.value === 'tile') {
            styles.backgroundSize = 'auto';
            styles.backgroundPosition = 'top left';
            styles.backgroundRepeat = 'repeat';
        }
    }
    return styles;
});
```

### 3.3. テンプレートの修正
- `.chat-wrapper` の背景色指定 (`backgroundColor: getRgbaBackground`) を外し、かわりに直下に背景レイヤー `<div class="chat-background" :style="chatBackgroundStyle"></div>` を追加。
- 枠線やフォントは `.chat-wrapper` に適用したままにします。
- 親の `.chat-wrapper` に `position: relative` および `z-index: 1` などのスタイルを保証し、背景レイヤーが正しく背面に描画されるようにします。また、ヘッダーやメッセージコンテナ、フッターなどの直下要素が背景の上に適切に配置されることを確認します。

---

## 4. マスコット画面への反映 (`ui/src/components/MascotViewer.vue`)

### 4.1. ストアデータのインポート
`storeToRefs` から以下をインポート：
- `mascotBackgroundColor`
- `mascotBackgroundOpacity`
- `mascotBackgroundImage`
- `mascotBackgroundImageOpacity`
- `mascotBackgroundImageFit`

### 4.2. スタイルの生成
`getMascotRgbaBackground` と `mascotBackgroundStyle` という `computed` プロパティを定義：
```typescript
const getMascotRgbaBackground = computed(() => {
    const hex = mascotBackgroundColor.value || '#ffffff';
    const opacity = mascotBackgroundOpacity.value !== undefined ? mascotBackgroundOpacity.value : 0.0;
    
    let r = 255, g = 255, b = 255;
    const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (match) {
        r = parseInt(match[1], 16);
        g = parseInt(match[2], 16);
        b = parseInt(match[3], 16);
    } else {
        const shortMatch = hex.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);
        if (shortMatch) {
            r = parseInt(shortMatch[1] + shortMatch[1], 16);
            g = parseInt(shortMatch[2] + shortMatch[2], 16);
            b = parseInt(shortMatch[3] + shortMatch[3], 16);
        }
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
});

const mascotBackgroundStyle = computed(() => {
    const styles: Record<string, any> = {
        backgroundColor: getMascotRgbaBackground.value,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: -1
    };
    if (mascotBackgroundImage.value) {
        styles.backgroundImage = `url(${resolveImageUrl(mascotBackgroundImage.value)})`;
        styles.opacity = mascotBackgroundImageOpacity.value;
        
        if (mascotBackgroundImageFit.value === 'cover') {
            styles.backgroundSize = 'cover';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (mascotBackgroundImageFit.value === 'contain') {
            styles.backgroundSize = 'contain';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (mascotBackgroundImageFit.value === 'fill') {
            styles.backgroundSize = '100% 100%';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (mascotBackgroundImageFit.value === 'tile') {
            styles.backgroundSize = 'auto';
            styles.backgroundPosition = 'top left';
            styles.backgroundRepeat = 'repeat';
        }
    }
    return styles;
});
```

### 4.3. テンプレートの修正
- `.mascot-wrapper` 内の最上位の子要素として `<div class="mascot-background" :style="mascotBackgroundStyle"></div>` を追加。
- 以下の CSS ルールを追加し、背景レイヤーを絶対配置で背面に固定します。
```css
.mascot-background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: -1;
    pointer-events: none;
}
```
- この背景領域は、キャラクター（`.mascot-character`）とは異なりマウス透過されるため、マスコットウィンドウとしての操作性（キャラクター以外クリック透過）を損なうことなく美しく背景を表示します。

---

## 5. 統合レイアウトへの反映 (`ui/src/components/layouts/IntegratedLayout.vue`)

### 5.1. ストアデータのインポート
`storeToRefs` から以下をインポート：
- `integratedBackgroundColor`
- `integratedBackgroundOpacity`
- `integratedBackgroundImage`
- `integratedBackgroundImageOpacity`
- `integratedBackgroundImageFit`
- `useServer`
- `serverHost`
- `serverPort`
- `configVersion`

### 5.2. スタイルの生成
`getRgbaBackground` と `integratedBackgroundStyle` という `computed` プロパティを定義：
```typescript
const getRgbaBackground = computed(() => {
    const hex = integratedBackgroundColor.value || '#1e1e2e';
    const opacity = integratedBackgroundOpacity.value !== undefined ? integratedBackgroundOpacity.value : 1.0;
    
    let r = 30, g = 30, b = 46;
    const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (match) {
        r = parseInt(match[1], 16);
        g = parseInt(match[2], 16);
        b = parseInt(match[3], 16);
    } else {
        const shortMatch = hex.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);
        if (shortMatch) {
            r = parseInt(shortMatch[1] + shortMatch[1], 16);
            g = parseInt(shortMatch[2] + shortMatch[2], 16);
            b = parseInt(shortMatch[3] + shortMatch[3], 16);
        }
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
});

const integratedBackgroundStyle = computed(() => {
    const styles: Record<string, any> = {
        backgroundColor: getRgbaBackground.value,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 0
    };
    if (integratedBackgroundImage.value) {
        styles.backgroundImage = `url(${resolveImageUrl(integratedBackgroundImage.value)})`;
        styles.opacity = integratedBackgroundImageOpacity.value;
        
        if (integratedBackgroundImageFit.value === 'cover') {
            styles.backgroundSize = 'cover';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (integratedBackgroundImageFit.value === 'contain') {
            styles.backgroundSize = 'contain';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (integratedBackgroundImageFit.value === 'fill') {
            styles.backgroundSize = '100% 100%';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (integratedBackgroundImageFit.value === 'tile') {
            styles.backgroundSize = 'auto';
            styles.backgroundPosition = 'top left';
            styles.backgroundRepeat = 'repeat';
        }
    }
    return styles;
});
```

### 5.3. テンプレートの修正
- `integrated-container` の直下に背景レイヤー `<div class="integrated-background" :style="integratedBackgroundStyle"></div>` を追加。
- 各セクション (`.mascot-section`, `.chat-section`) に `z-index: 1` を指定し、背景レイヤーの上にコンテンツが適切に配置されることを保証します。
- 以下の CSS ルールを追加：
```css
.integrated-background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 0;
    pointer-events: none;
}
```


