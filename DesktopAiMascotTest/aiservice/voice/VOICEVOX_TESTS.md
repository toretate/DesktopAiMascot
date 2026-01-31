# VoiceVoxService テストドキュメント

## 概要

このドキュメントは、VoiceVoxServiceのテストケースについて説明します。

## テストの種類

### 1. 単体テスト (`VoiceVoxServiceTests.cs`)

VoiceVoxServiceの基本的な機能とスキーマクラスをテストします。
サーバーへの接続は必要ありません。

#### テスト項目

##### 基本プロパティのテスト
- ✅ コンストラクタによる初期化
- ✅ Name プロパティ
- ✅ EndPoint プロパティ
- ✅ Url プロパティの設定と取得

##### GetAvailableModels のテスト
- ✅ VoiceVoxにはモデルの概念がないため空配列を返すことを確認

##### Speaker ID 抽出のテスト
- ✅ 正しい形式の文字列からIDを抽出
- ✅ 不正な形式の文字列の処理
- ✅ 複数のスタイルのテスト

##### スキーマクラスのテスト
- ✅ VoiceVoxSpeaker のインスタンス化
- ✅ VoiceVoxAudioQuery のインスタンス化
- ✅ VoiceVoxAccentPhrase のインスタンス化
- ✅ VoiceVoxMora のインスタンス化
- ✅ VoiceVoxSpeakerInfo のインスタンス化

##### AudioQuery パラメータのカスタマイズテスト
- ✅ SpeedScale の変更
- ✅ PitchScale の変更
- ✅ VolumeScale の変更
- ✅ デフォルト値の検証

##### エッジケースのテスト
- ✅ null 値の許容
- ✅ 子音がないモーラ（「ん」など）の処理

#### 実行方法

```bash
cd DesktopAiMascotTest
dotnet test --filter "VoiceVoxServiceTests"
```

---

### 2. 統合テスト (`VoiceVoxServiceIntegrationTests.cs`)

実際のVoiceVoxサーバーとの通信をテストします。

#### 前提条件

- ✅ VoiceVoxエンジンが `http://localhost:50021` で起動していること
- ✅ 環境変数 `RUN_INTEGRATION_TESTS=true` を設定すること

#### テスト項目

##### サーバー接続テスト
- ✅ コアバージョンの取得
- ✅ 話者一覧の取得
- ✅ フォーマット済み話者一覧の取得

##### 話者初期化テスト
- ✅ 話者の初期化
- ✅ 初期化状態の確認

##### AudioQuery作成テスト
- ✅ 短いテキストでのクエリ作成
- ✅ 長いテキストでのクエリ作成
- ✅ 特殊文字を含むテキストの処理

##### 音声合成テスト
- ✅ AudioQueryを使った音声合成
- ✅ 統一インターフェースでの音声合成
- ✅ 異なる話者での音声合成

##### AudioQueryパラメータカスタマイズテスト
- ✅ 速度変更
- ✅ 音高変更
- ✅ 音量変更

##### SpeakerInfo取得テスト
- ✅ 話者の詳細情報取得

##### ストリーミング合成テスト
- ✅ ストリーミング合成（1チャンクで返却）

##### エラーハンドリングテスト
- ✅ Speaker未設定時の処理
- ✅ 不正なSpeaker形式の処理

##### 並行処理テスト
- ✅ 複数の同時リクエストの処理

#### 実行方法

```bash
# 環境変数を設定
$env:RUN_INTEGRATION_TESTS="true"

# VoiceVoxエンジンを起動
# http://localhost:50021 で起動していることを確認

# テストを実行
cd DesktopAiMascotTest
dotnet test --filter "VoiceVoxServiceIntegrationTests"
```

---

### 3. スキーマテスト (`VoiceVoxServiceSchemaTests.cs`)

JSONスキーマファイルとC#クラスの整合性をテストします。

#### テスト項目

##### スキーマファイルの存在確認
- ✅ スキーマディレクトリの存在
- ✅ 各スキーマファイルの存在

##### Speaker スキーマテスト
- ✅ デシリアライズ可能性
- ✅ 必須フィールドの存在
- ✅ スタイル情報のフィールド

##### AudioQuery スキーマテスト
- ✅ デシリアライズ可能性
- ✅ 必須フィールドの存在
- ✅ アクセント句のフィールド
- ✅ モーラのフィールド
- ✅ null子音の許容

##### SpeakerInfo スキーマテスト
- ✅ デシリアライズ可能性
- ✅ 必須フィールドの存在
- ✅ スタイル詳細情報のフィールド

##### CoreVersions スキーマテスト
- ✅ デシリアライズ可能性
- ✅ バージョン形式の検証

##### JSON形式の検証
- ✅ すべてのスキーマファイルが有効なJSON

##### スキーマとクラスの整合性テスト
- ✅ VoiceVoxSpeaker の構造一致
- ✅ VoiceVoxAudioQuery の構造一致

#### 実行方法

```bash
cd DesktopAiMascotTest
dotnet test --filter "VoiceVoxServiceSchemaTests"
```

---

## スキーマファイル

### 1. VoiceVox_Speaker_Response.json

話者一覧のレスポンススキーマ

```json
[
  {
    "name": "四国めたん",
    "speaker_uuid": "7ffcb7ce-00ec-4bdc-82cd-45a8889e43ff",
    "styles": [
      {
        "name": "ノーマル",
        "id": 2,
        "type": "talk"
      }
    ],
    "version": "0.25.1",
    "supported_features": {
      "permitted_synthesis_morphing": "ALL"
    }
  }
]
```

### 2. VoiceVox_AudioQuery_Response.json

音声合成クエリのレスポンススキーマ

```json
{
  "accent_phrases": [ ... ],
  "speedScale": 1.0,
  "pitchScale": 0.0,
  "intonationScale": 1.0,
  "volumeScale": 1.0,
  "prePhonemeLength": 0.1,
  "postPhonemeLength": 0.1,
  "outputSamplingRate": 24000,
  "outputStereo": false,
  "kana": "コンニチワ"
}
```

### 3. VoiceVox_SpeakerInfo_Response.json

話者詳細情報のレスポンススキーマ

```json
{
  "policy": "...",
  "portrait": "data:image/png;base64,...",
  "style_infos": [ ... ]
}
```

### 4. VoiceVox_CoreVersions_Response.json

コアバージョン一覧のレスポンススキーマ

```json
[
  "0.14.5"
]
```

---

## テストカバレッジ

### 単体テスト
- ✅ 基本機能: 100%
- ✅ スキーマクラス: 100%
- ✅ エッジケース: カバー済み

### 統合テスト
- ✅ API エンドポイント: 7/7 (100%)
  - `/speakers`
  - `/initialize_speaker`
  - `/is_initialized_speaker`
  - `/audio_query`
  - `/synthesis`
  - `/speaker_info`
  - `/core_versions`

### スキーマテスト
- ✅ スキーマファイル: 4/4 (100%)
- ✅ デシリアライズ: 100%
- ✅ フィールド検証: 100%

---

## 既知の制限事項

1. **ストリーミング非対応**
   - VoiceVoxはストリーミング合成をサポートしていないため、`SynthesizeStreamAsync` は1チャンクで返します

2. **モデルの概念なし**
   - VoiceVoxにはStyleBertVits2のような「モデル」の概念がないため、`GetAvailableModels` は空配列を返します

3. **並行処理制御**
   - `SemaphoreSlim` を使用して音声合成の並行実行を制御しています

---

## トラブルシューティング

### 統合テストがスキップされる

```
Skip: RUN_INTEGRATION_TESTS環境変数がtrueに設定されていません
```

**解決方法:**
```powershell
$env:RUN_INTEGRATION_TESTS="true"
dotnet test
```

### VoiceVoxサーバーに接続できない

```
[VoiceVox] GetSpeakersAsync エラー: ...
```

**解決方法:**
1. VoiceVoxエンジンが起動していることを確認
2. `http://localhost:50021/speakers` にアクセスできることを確認
3. ファイアウォールの設定を確認

### テストが失敗する

**確認事項:**
1. VoiceVoxエンジンのバージョン（0.25.1推奨）
2. サーバーの起動状態
3. ポート番号（デフォルト: 50021）

---

## 参考リンク

- [VoiceVox 公式サイト](https://voicevox.hiroshiba.jp/)
- [VoiceVox Engine API仕様](http://127.0.0.1:50021/docs)
- [VoiceVoxService実装](../../aiservice/voice/VoiceVoxService.cs)
- [VoiceVoxService README](../../aiservice/voice/VoiceVoxService_README.md)
