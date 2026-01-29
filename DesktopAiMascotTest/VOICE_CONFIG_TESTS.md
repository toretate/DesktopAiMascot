# Voice設定機能のテストケース

このディレクトリには、マスコットごとのVoice設定機能に関するテストケースが含まれています。

## テストファイル

### 1. MascotVoiceConfigTests.cs
マスコットのVoice設定の基本機能をテストします。

**テスト対象:**
- `MascotConfig.Voice`プロパティの初期化
- `VoiceServiceConfig`の基本機能
- Voice設定の追加・更新
- YAMLシリアライゼーション/デシリアライゼーション
- `MascotModel.SaveVoiceConfig()`メソッド
- ファイルへの保存と読み込み

**テストケース:**
- `MascotConfig_VoiceProperty_ShouldBeInitialized` - Voice辞書が初期化されることを確認
- `VoiceServiceConfig_ShouldHaveModelAndSpeaker` - VoiceServiceConfigの基本プロパティ
- `MascotConfig_CanAddVoiceConfiguration` - Voice設定の追加
- `MascotConfig_CanAddMultipleVoiceServices` - 複数のVoiceサービス設定
- `MascotConfigIO_ShouldSerializeVoiceConfig` - YAMLシリアライゼーション
- `MascotConfigIO_ShouldDeserializeVoiceConfig` - YAMLデシリアライゼーション
- `MascotConfigIO_ShouldHandleEmptyVoiceConfig` - 空のVoice設定の処理
- `MascotModel_SaveVoiceConfig_ShouldUpdateConfig` - Voice設定の保存
- `MascotModel_SaveVoiceConfig_ShouldOverwriteExistingConfig` - 既存設定の上書き
- `MascotConfigIO_RoundTrip_ShouldPreserveVoiceConfig` - 完全なラウンドトリップ

### 2. StyleBertVits2VoiceConfigTests.cs
StyleBertVits2ServiceのVoice設定関連機能をテストします。

**テスト対象:**
- `ExtractModelName()` - model_pathからモデル名を抽出
- `ParseModelId()` - モデル名からIDを取得
- `ParseSpeakerId()` - スピーカー名からIDを取得
- モデル名/スピーカー名のマッピング

**テストケース:**
- `ExtractModelName_ShouldExtractDirectoryName` - ディレクトリ名の抽出
- `ParseModelId_ShouldParseFromModelName` - モデル名からのID解析
- `ParseModelId_ShouldHandleLegacyFormat` - 旧形式("0: モデル名")のサポート
- `ParseSpeakerId_ShouldParseFromSpeakerName` - スピーカー名からのID解析
- `ModelInfo_ShouldHaveRequiredProperties` - ModelInfoの必須プロパティ
- `VoiceServiceConfig_ShouldInitializeWithEmptyStrings` - 初期化確認
- `ExtractModelName_ShouldHandleInvalidPaths` - 無効なパスの処理
- `Service_ShouldMaintainModelAndSpeakerProperties` - プロパティの保持
- `Service_ModelAndSpeakerProperties_ShouldBeIndependent` - プロパティの独立性

### 3. VoiceConfigIntegrationTests.cs
実際のワークフローを想定した統合テストです。

**テストシナリオ:**
- `Scenario_SaveAndLoadVoiceConfig_ShouldWork` - 保存と読み込みの完全なフロー
- `Scenario_SwitchMascot_VoiceConfigShouldChange` - マスコット切り替え時の動作
- `Scenario_MultipleVoiceServices_ShouldCoexist` - 複数のVoiceサービスの共存
- `Scenario_UpdateExistingVoiceConfig_ShouldOverwrite` - 既存設定の更新
- `Scenario_VoiceConfigNotSet_ShouldReturnEmptyDictionary` - 未設定時の動作
- `Scenario_LoadConfigWithSystemPromptAndVoice_ShouldPreserveBoth` - 全体設定の保持
- `Scenario_EmptyModelOrSpeaker_ShouldBeHandled` - 空の値の処理

## テストの実行方法

### すべてのテストを実行
```bash
dotnet test
```

### 特定のテストクラスを実行
```bash
dotnet test --filter "FullyQualifiedName~MascotVoiceConfigTests"
dotnet test --filter "FullyQualifiedName~StyleBertVits2VoiceConfigTests"
dotnet test --filter "FullyQualifiedName~VoiceConfigIntegrationTests"
```

### 特定のテストケースを実行
```bash
dotnet test --filter "FullyQualifiedName~MascotConfig_VoiceProperty_ShouldBeInitialized"
```

### Visual Studioでの実行
1. テストエクスプローラーを開く（テスト > テストエクスプローラー）
2. すべてのテストを実行（Ctrl+R, A）
3. 特定のテストを右クリックして「テストの実行」

## テストカバレッジ

これらのテストは以下の機能をカバーしています：

✅ **基本機能**
- MascotConfigへのVoice辞書の追加
- VoiceServiceConfigの基本プロパティ
- YAMLシリアライゼーション/デシリアライゼーション

✅ **ファイルI/O**
- config.yamlへの保存
- config.yamlからの読み込み
- ファイルの上書き保存

✅ **StyleBertVits2統合**
- モデル名の抽出（model_path → ディレクトリ名）
- スピーカー名の抽出（id2spk → key）
- 名前↔IDのマッピング

✅ **実際のワークフロー**
- マスコットごとの独立したVoice設定
- マスコット切り替え時の設定変更
- 複数のVoiceサービスの管理

## 注意事項

### リフレクションの使用
一部のテストでは、privateメソッドをテストするためにリフレクションを使用しています。
これは実装の詳細をテストするためのものであり、本番コードでは使用しないでください。

### 一時ファイル
ファイルI/Oのテストでは一時ファイルを使用します。
テストは必ず`try-finally`ブロックでファイルをクリーンアップします。

### 統合テストの前提条件
統合テストを実行する前に、以下を確認してください：
- StyleBertVits2サーバーが起動している（統合テストの一部は`[IntegrationFact]`属性でマークされています）
- 必要なモデルがインストールされている

## 今後の拡張

以下のテストケースを追加することを検討してください：

- [ ] VoiceAiPropertyPageのUIテスト
- [ ] マスコット切り替え時の自動適用のテスト
- [ ] 起動時のVoice設定読み込みのテスト
- [ ] エラーハンドリングのテスト
- [ ] パフォーマンステスト
- [ ] 並行処理のテスト

## 関連ドキュメント

- [StyleBertVits2 API仕様](../aiservice/voice/schemas/README.md)
- [マスコット設定仕様](../assets/mascots/README.md)
- [統合テストガイド](./README.md)
