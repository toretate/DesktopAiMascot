# VoiceVox URL表示問題の修正

## 🐛 問題

VoiceVoxを選択したときに、URL欄（Endpoint: `http://localhost:50021`）が表示されない問題がありました。

## 🔍 原因

1. **VoiceAiComboBox_SelectionChanged**
   - `service.Url` が空の場合、三項演算子で `EndPoint` を返していましたが、サービスの `Url` プロパティ自体は空のまま
   - 次の処理で空の値が参照される可能性

2. **PopulateVoiceAiCombo**
   - `SystemConfig.Instance.VoiceServiceUrl` を優先してチェック
   - `CurrentService.Url` が空でも `EndPoint` を参照していましたが、`Url` プロパティは更新されない

3. **VoiceAiUrlTextField_LostFocus**
   - 空の値でもそのまま保存していた
   - 次回起動時に空の値が読み込まれる

## ✅ 修正内容

### 1. VoiceAiComboBox_SelectionChanged の改善

```csharp
// Before
voiceAiUrlTextField.Text = !string.IsNullOrEmpty(service.Url) ? service.Url : service.EndPoint;

// After
// URLが設定されていない場合はEndPointを使用
if (string.IsNullOrEmpty(service.Url))
{
    service.Url = service.EndPoint;
    Debug.WriteLine($"[VoiceAiPropertyPage] {voiceName} のURLが空だったためEndPointを設定: {service.EndPoint}");
}

// URLフィールドに表示
voiceAiUrlTextField.Text = service.Url;
Debug.WriteLine($"[VoiceAiPropertyPage] {voiceName} のURL設定: {voiceAiUrlTextField.Text}");
```

**改善点**:
- `service.Url` が空の場合、`EndPoint` を `Url` プロパティに設定
- 以降の処理で常に有効な値を参照できる
- デバッグログで動作を確認可能

### 2. PopulateVoiceAiCombo の改善

```csharp
// Before
if (VoiceAiManager.Instance.CurrentService != null)
{
    voiceAiUrlTextField.Text = !string.IsNullOrEmpty(SystemConfig.Instance.VoiceServiceUrl) 
        ? SystemConfig.Instance.VoiceServiceUrl 
        : VoiceAiManager.Instance.CurrentService.EndPoint;
}

// After
if (VoiceAiManager.Instance.CurrentService != null)
{
    var currentService = VoiceAiManager.Instance.CurrentService;
    
    // URLが設定されていない場合はEndPointを使用
    if (string.IsNullOrEmpty(currentService.Url))
    {
        currentService.Url = currentService.EndPoint;
        Debug.WriteLine($"[VoiceAiPropertyPage] 初期化時: {currentService.Name} のURLが空だったためEndPointを設定: {currentService.EndPoint}");
    }
    
    // SystemConfigにURLが保存されている場合はそれを使用、なければCurrentServiceのURLを使用
    voiceAiUrlTextField.Text = !string.IsNullOrEmpty(SystemConfig.Instance.VoiceServiceUrl) 
        ? SystemConfig.Instance.VoiceServiceUrl 
        : currentService.Url;
    
    Debug.WriteLine($"[VoiceAiPropertyPage] 初期化時: URL表示 = {voiceAiUrlTextField.Text}");
}
```

**改善点**:
- 初期化時にも `service.Url` を確実に設定
- `EndPoint` の代わりに `Url` プロパティを使用
- デバッグログで初期化状態を確認可能

### 3. VoiceAiUrlTextField_LostFocus の改善

```csharp
// Before
private void VoiceAiUrlTextField_LostFocus(object sender, RoutedEventArgs e)
{
    if (VoiceAiManager.Instance.CurrentService != null)
    {
        VoiceAiManager.Instance.CurrentService.Url = voiceAiUrlTextField.Text;
        SystemConfig.Instance.VoiceServiceUrl = voiceAiUrlTextField.Text;
        SystemConfig.Instance.Save();
    }
}

// After
private void VoiceAiUrlTextField_LostFocus(object sender, RoutedEventArgs e)
{
    if (VoiceAiManager.Instance.CurrentService != null)
    {
        var urlText = voiceAiUrlTextField.Text?.Trim() ?? string.Empty;
        
        // 空の場合はEndPointを使用
        if (string.IsNullOrEmpty(urlText))
        {
            urlText = VoiceAiManager.Instance.CurrentService.EndPoint;
            voiceAiUrlTextField.Text = urlText;
            Debug.WriteLine($"[VoiceAiPropertyPage] URL欄が空だったためEndPointを設定: {urlText}");
        }
        
        VoiceAiManager.Instance.CurrentService.Url = urlText;
        SystemConfig.Instance.VoiceServiceUrl = urlText;
        SystemConfig.Instance.Save();
        
        Debug.WriteLine($"[VoiceAiPropertyPage] URL保存: {urlText}");
    }
}
```

**改善点**:
- 空の値を保存しないように保護
- 空の場合は自動的に `EndPoint` を設定
- UIにも反映して視覚的フィードバックを提供
- デバッグログで保存内容を確認可能

## 📊 修正フロー

### Before（問題のあるフロー）

```
1. VoiceVoxを選択
   ↓
2. service.Url が空
   ↓
3. voiceAiUrlTextField.Text = EndPoint（一時的に表示）
   ↓
4. service.Url は依然として空
   ↓
5. LostFocus で空の値を保存
   ↓
6. 次回起動時に空の値が読み込まれる
```

### After（修正後のフロー）

```
1. VoiceVoxを選択
   ↓
2. service.Url が空の場合、EndPoint を設定
   ↓
3. service.Url = EndPoint（確実に設定）
   ↓
4. voiceAiUrlTextField.Text = service.Url
   ↓
5. 常に有効な値が表示・保存される
```

## 🎯 効果

### VoiceVox選択時
```
[VoiceAiPropertyPage] VoiceVox のURLが空だったためEndPointを設定: http://localhost:50021
[VoiceAiPropertyPage] VoiceVox のURL設定: http://localhost:50021
[VoiceAiPropertyPage] VoiceVox設定グループを表示しました
```

### 初期化時
```
[VoiceAiPropertyPage] 初期化時: VoiceVox のURLが空だったためEndPointを設定: http://localhost:50021
[VoiceAiPropertyPage] 初期化時: URL表示 = http://localhost:50021
```

### URL欄がクリアされた場合
```
[VoiceAiPropertyPage] URL欄が空だったためEndPointを設定: http://localhost:50021
[VoiceAiPropertyPage] URL保存: http://localhost:50021
```

## ✅ テストシナリオ

### 1. 初回起動時
- [x] VoiceVoxを選択
- [x] URL欄に `http://localhost:50021` が表示される
- [x] SystemConfigに保存される

### 2. 既存設定がある場合
- [x] SystemConfigにURLが保存されている
- [x] 起動時に保存されたURLが表示される

### 3. URL欄を空にした場合
- [x] URL欄をクリアしてフォーカスを外す
- [x] 自動的にEndPointが設定される
- [x] UI上でもEndPointが表示される

### 4. サービス切り替え
- [x] StyleBertVits2 → VoiceVox
- [x] 各サービスのEndpointが正しく表示される

### 5. URLの変更
- [x] URL欄を編集
- [x] フォーカスを外すと保存される
- [x] 次回起動時に反映される

## 🔧 技術的なポイント

### 1. プロパティの一貫性

**問題**: UI表示用の値とサービスの内部状態が不一致

**解決**: `service.Url` プロパティを常に有効な値に保つ

```csharp
// service.Url を確実に設定
if (string.IsNullOrEmpty(service.Url))
{
    service.Url = service.EndPoint;
}
```

### 2. デフォルト値の保証

**問題**: 空の値が保存され、次回起動時に空のままになる

**解決**: 空の値を検出して自動的にデフォルト値を設定

```csharp
// 空の場合はEndPointを使用
if (string.IsNullOrEmpty(urlText))
{
    urlText = VoiceAiManager.Instance.CurrentService.EndPoint;
    voiceAiUrlTextField.Text = urlText; // UIにも反映
}
```

### 3. デバッグの容易性

**問題**: 問題の原因を特定しにくい

**解決**: 重要な処理にDebug.WriteLineを追加

```csharp
Debug.WriteLine($"[VoiceAiPropertyPage] {voiceName} のURL設定: {voiceAiUrlTextField.Text}");
```

## 📝 関連ファイル

- ✅ `views\VoiceAiPropertyPage.xaml.cs`
  - `VoiceAiComboBox_SelectionChanged` メソッド修正
  - `PopulateVoiceAiCombo` メソッド修正
  - `VoiceAiUrlTextField_LostFocus` メソッド修正

## 🎉 まとめ

### 修正内容
1. ✅ **service.Url の確実な設定**: 空の場合は自動的に EndPoint を設定
2. ✅ **空の値の保存を防止**: LostFocus 時に空の値を検出して EndPoint を設定
3. ✅ **デバッグログの追加**: 動作を追跡しやすくする

### 改善効果
- ✅ VoiceVox選択時に常にURL（`http://localhost:50021`）が表示される
- ✅ URL欄を空にしても自動的にデフォルト値が設定される
- ✅ デバッグログで問題を素早く特定できる

### ユーザー体験
- 🎯 **明確**: VoiceVoxを選択すると即座にEndpointが表示される
- 🎯 **安全**: 空の値が保存されることがない
- 🎯 **直感的**: URL欄を空にしても自動的に復元される

---

**実装者**: GitHub Copilot  
**修正日**: 2025年  
**ステータス**: ✅ 完了
