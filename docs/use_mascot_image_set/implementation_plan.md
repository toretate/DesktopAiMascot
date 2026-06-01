# 実装計画: 配列で持っている画像セットを MascotImageSet を使うように修正する

マスコットの画像管理を `string[]` や直接の画像パス配列ベースから、`MascotImageSet` を用いたオブジェクト指向かつ統一的な画像セット管理へと移行し、マスコットモデルと 1:1 で画像を扱う構成に整理します。

また、Node.js / TypeScript 環境に対応したテスト（Vitest を利用）を構築し、画像セットのパースやフォールバックロジックが意図通り動作することを検証します。

## ユーザーレビューが必要な事項

- **テストフレームワークとして Vitest の導入**:
  - Vite プロジェクトであるため、設定が不要で高速な `vitest` をテストランナーとして導入することを提案します。Jest と同様の API（`describe`, `test`, `expect`）で動作し、TypeScript や Vue コンポーネントのテストも追加の設定なしでサポートされます。
  
- **MascotImageSet の統合場所**:
  - `MascotImageSet` クラスと `MascotImageSetBuilder` クラスを `src/mascots/` ディレクトリに新規作成し、レンダープロセス（Vue3 側）および必要に応じて将来メインプロセス側でも共通して再利用できる構成にします。

## オープン質問

- 特になし。

## 提案する変更

---

### [Component: Core mascot logic]

#### [NEW] [MascotImageSet.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/src/mascots/MascotImageSet.ts)
マスコット画像セットを管理する TypeScript クラスを定义します。
- `Name`: マスコット画像セットのベース名
- `Image`: 代表画像アセット
- `AngleImages`: 各角度（方向）の画像アセット (`left`, `right`, `front`, `back`, `top`, `bottom` 等)
- `EmotionFaceImages`: 各感情の表情（顔のみ）の画像アセット (28感情)
- `EmotionFullbodyImages`: 各感情の全身の画像アセット (28感情)
- `GetFrontImage()`: 正面画像を取得（なければ代表画像や他の角度画像にフォールバック）
- `GetEmotionFaceImage(emotion)`: 感情に対応する顔画像を取得
- `GetEmotionFullbodyImage(emotion)`: 感情に対応する全身画像を取得
- `GetAngleImage(angle)`: 指定方向の画像を取得
- `GetPrimaryImage()`: 代表表示用の画像を取得
- `GetAllImages()`: このセットに属する全画像を重複なく取得

#### [NEW] [MascotImageSetBuilder.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/src/mascots/MascotImageSetBuilder.ts)
画像ファイル名またはアセット配列から `MascotImageSet` を構築するビルダー。
- `AngleSuffixes` や `FullbodyTokens` を用いて、ファイル名（アンダースコア `_` 区切り）から方向や感情、顔か全身かをパースします。
- `cover.png` は代表画像（カバー画像）として扱い、チャット用のセットからは除外するロジックを実装します。

---

### [Component: UI components]

#### [MODIFY] [MascotViewer.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/MascotViewer.vue)
- マスコットデータを読み込んだ際、`MascotImageSetBuilder.CreateFromAssets` を用いて `MascotImageSet` を動的に構築します。
- computed プロパティや表示切り替えロジックにおいて、直接のアセット配列検索から `MascotImageSet` のメソッド（`GetFrontImage()`, `GetEmotionFaceImage()` 等）を介したアクセスへ移行します。

---

### [Component: Infrastructure & Testing]

#### [MODIFY] [package.json](file:///c:/workspace/workspace-win/DesktopAiMascot/package.json)
- `vitest` を `devDependencies` に追加します。
- `scripts` に `"test": "vitest run"` (1回実行) および `"test:watch": "vitest"` (ウォッチモード) を追加します。

#### [NEW] [MascotImageSetBuilder.test.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/src/mascots/__tests__/MascotImageSetBuilder.test.ts)
`MascotImageSetBuilder` および `MascotImageSet` の動作を検証する単体テスト。
- C# 時代の `MascotImageSetBuilderTests.cs` のテストケースを TypeScript / Vitest に移植します。
  - `CreateFromItems_方向画像と表情画像をセット単位で分類できる`
  - `GetPrimaryImage_代表画像が無い場合は角度画像をフォールバックする`
- すべてのテスト名およびアサーションの解説は日本語で記述します。

## 検証計画

### 自動テスト
- `npm run test` を実行し、新規追加した `MascotImageSetBuilder.test.ts` がすべて正常にパスすることを確認します。

### 手動検証
- アプリを `npm run dev` で起動し、マスコットウィンドウにキャラクターの表情やポーズが正しく表示されること。
- チャットウィンドウでの会話や感情変化に応じて、表情の切り替えが正しく動作し続けること。
