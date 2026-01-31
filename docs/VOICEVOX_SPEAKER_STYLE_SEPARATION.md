# VoiceVox Speaker/Style分離UI実装

## ✅ 実装完了

VoiceAiPropertyPageのVoiceVox設定を、SpeakerとStyleを別々に選択できるように改善しました。

---

## 🎯 実装の目的

### 以前の実装
- 単一のComboBoxで `"四国めたん (ノーマル) [2]"` という形式の文字列を選択
- ユーザーにとって分かりにくい
- StylesのIDが直接表示される

### 新しい実装
- **Speaker（キャラクター）** と **Style（スタイル）** を別々のComboBoxで選択
- 直感的で分かりやすいUI
- Speaker選択時にそのSpeakerのStylesのみが表示される

---

## 📁 変更ファイル

### 1. XAML (UI定義)
**ファイル**: `views\VoiceAiPropertyPage.xaml`

```xaml
<!-- VoiceVox専用設定 -->
<GroupBox x:Name="voiceVoxSettingsGroup" 
          Header="VoiceVox 設定" 
          Padding="10" 
          Margin="0,0,0,10"
          Visibility="Collapsed">
    <StackPanel>
        <!-- Speakerコンボボックス -->
        <Label Content="Speaker (キャラクター)" FontSize="11" Padding="0" Margin="0,0,0,2"/>
        <ComboBox x:Name="voiceVoxSpeakerComboBox" 
                  Height="25"
                  Margin="0,0,0,10"
                  SelectionChanged="VoiceVoxSpeakerComboBox_SelectionChanged"/>

        <!-- Styleコンボボックス（新規追加） -->
        <Label Content="Style (スタイル)" FontSize="11" Padding="0" Margin="0,0,0,2"/>
        <ComboBox x:Name="voiceVoxStyleComboBox" 
                  Height="25"
                  Margin="0,0,0,0"
                  SelectionChanged="VoiceVoxStyleComboBox_SelectionChanged"/>
    </StackPanel>
</GroupBox>
```

### 2. コードビハインド
**ファイル**: `views\VoiceAiPropertyPage.xaml.cs`

#### 追加クラス
```csharp
/// <summary>
/// VoiceVoxのStyleをComboBoxに表示するためのヘルパークラス
/// </summary>
internal class VoiceVoxStyleDisplayItem
{
    public string DisplayName { get; set; } = string.Empty;
    public VoiceVoxSpeakerStyle Style { get; set; } = new VoiceVoxSpeakerStyle();
}
```

#### フィールド追加
```csharp
// VoiceVoxのSpeakerデータを保持
private VoiceVoxSpeaker[]? _voiceVoxSpeakers = null;
```

---

## 🔧 実装の詳細

### 1. Speaker一覧の取得と表示

**UpdateModelAndSpeakerList メソッド（VoiceVox部分）**

```csharp
// VoiceVoxServiceからSpeaker一覧を取得
_voiceVoxSpeakers = await voiceVoxService.GetSpeakersAsync();

// Speaker名のリストを作成
var speakerNames = _voiceVoxSpeakers.Select(s => s.Name).ToArray();
voiceVoxSpeakerComboBox.ItemsSource = speakerNames;

// 現在の設定から復元
// 形式: "四国めたん (ノーマル) [2]" → "四国めたん" を抽出
var match = Regex.Match(currentSpeaker, @"^(.+?)\s*\(.+?\)\s*\[(\d+)\]$");
if (match.Success)
{
    selectedSpeakerName = match.Groups[1].Value; // "四国めたん"
    selectedStyleId = int.Parse(match.Groups[2].Value); // 2
}

// Speakerを選択
voiceVoxSpeakerComboBox.SelectedItem = selectedSpeakerName;
```

### 2. Speaker選択時のStyle一覧更新

**VoiceVoxSpeakerComboBox_SelectionChanged メソッド**

```csharp
// 選択されたSpeakerを検索
var selectedSpeaker = _voiceVoxSpeakers.FirstOrDefault(s => s.Name == speakerName);

// Styleリストを作成（表示用アイテム）
var styleDisplayItems = selectedSpeaker.Styles
    .Select(style => new VoiceVoxStyleDisplayItem
    {
        DisplayName = $"{style.Name} [{style.Id}]", // "ノーマル [2]"
        Style = style
    })
    .ToArray();

voiceVoxStyleComboBox.ItemsSource = styleDisplayItems;
voiceVoxStyleComboBox.DisplayMemberPath = "DisplayName";

// 現在のStyle IDが一致するものを選択
var matchingItem = styleDisplayItems.FirstOrDefault(item => item.Style.Id == selectedStyleId.Value);
voiceVoxStyleComboBox.SelectedItem = matchingItem;
```

### 3. Style選択時の保存

**VoiceVoxStyleComboBox_SelectionChanged メソッド**

```csharp
// Speaker名とStyleを組み合わせて保存形式を作成
string formattedSpeaker = $"{speakerName} ({styleItem.Style.Name}) [{styleItem.Style.Id}]";
// 例: "四国めたん (ノーマル) [2]"

// SystemConfigとVoiceAiManagerに保存
VoiceAiManager.Instance.CurrentService.Speaker = formattedSpeaker;
SystemConfig.Instance.VoiceServiceSpeaker = formattedSpeaker;
SystemConfig.Instance.Save();
```

---

## 🎨 UI操作フロー

### 初回読み込み

```
1. VoiceVoxを選択
   ↓
2. GetSpeakersAsync()でSpeaker一覧取得
   ↓
3. voiceVoxSpeakerComboBox に表示
   例: ["四国めたん", "ずんだもん", "春日部つむぎ", ...]
   ↓
4. 保存されている設定から復元
   "四国めたん (ノーマル) [2]" → "四国めたん" と ID:2 を抽出
   ↓
5. "四国めたん" を選択 → Styles更新
   ↓
6. ID:2 に一致する "ノーマル [2]" を選択
```

### Speakerを変更した場合

```
User: voiceVoxSpeakerComboBox で "ずんだもん" を選択
   ↓
VoiceVoxSpeakerComboBox_SelectionChanged()
   ↓
"ずんだもん" のStyles を検索
   ↓
voiceVoxStyleComboBox を更新
表示: ["ノーマル [3]", "あまあま [1]", "ツンツン [7]", "セクシー [5]"]
   ↓
最初のStyle（"ノーマル [3]"）を自動選択
   ↓
VoiceVoxStyleComboBox_SelectionChanged()
   ↓
"ずんだもん (ノーマル) [3]" を保存
```

### Styleを変更した場合

```
User: voiceVoxStyleComboBox で "あまあま [1]" を選択
   ↓
VoiceVoxStyleComboBox_SelectionChanged()
   ↓
Speaker名 "ずんだもん" と Style "あまあま [1]" を組み合わせ
   ↓
"ずんだもん (あまあま) [1]" を保存
   ↓
SystemConfig と VoiceAiManager に反映
```

---

## 📊 データ構造

### VoiceVoxSpeaker（既存）

```csharp
public class VoiceVoxSpeaker
{
    public string Name { get; set; } // "四国めたん"
    public string Speaker_Uuid { get; set; }
    public VoiceVoxSpeakerStyle[] Styles { get; set; }
    public string Version { get; set; }
}
```

### VoiceVoxSpeakerStyle（既存）

```csharp
public class VoiceVoxSpeakerStyle
{
    public string Name { get; set; } // "ノーマル"
    public int Id { get; set; } // 2
    public string Type { get; set; } // "talk"
}
```

### VoiceVoxStyleDisplayItem（新規）

```csharp
internal class VoiceVoxStyleDisplayItem
{
    public string DisplayName { get; set; } // "ノーマル [2]"
    public VoiceVoxSpeakerStyle Style { get; set; }
}
```

---

## 🔄 互換性の維持

### 保存形式

**変更なし**: `"キャラクター名 (スタイル名) [ID]"`

```
"四国めたん (ノーマル) [2]"
"ずんだもん (あまあま) [1]"
"春日部つむぎ (セクシー) [10]"
```

- マスコットのconfig.yamlとの互換性維持
- 既存の保存データをそのまま読み込み可能
- VoiceVoxService側の変更不要

### 読み込み時の処理

```csharp
// 保存データ: "四国めたん (ノーマル) [2]"
var match = Regex.Match(saved, @"^(.+?)\s*\(.+?\)\s*\[(\d+)\]$");

// 抽出:
// match.Groups[1].Value → "四国めたん"（Speaker名）
// match.Groups[2].Value → "2"（Style ID）

// UIに反映:
// voiceVoxSpeakerComboBox → "四国めたん" を選択
// voiceVoxStyleComboBox → ID:2 の Style を選択
```

---

## ✨ 改善されたユーザー体験

### Before（以前）

```
[ Speaker: 四国めたん (ノーマル) [2]  ▼ ]
```

- すべてのSpeakerとStyleの組み合わせがフラットに表示
- 長いリスト（例: 50個以上）から選択が困難
- IDの意味が分かりにくい

### After（改善後）

```
[ Speaker (キャラクター): 四国めたん  ▼ ]
[ Style (スタイル): ノーマル [2]  ▼ ]
```

- **段階的な選択**: まずキャラクターを選び、次にスタイルを選ぶ
- **絞り込み**: Styleは選択したSpeakerのものだけ表示
- **直感的**: 日本語ラベルで分かりやすい

---

## 📝 実装のポイント

### 1. イベントハンドラーの管理

無限ループを防ぐため、プログラムでComboBoxを更新する際はイベントハンドラーを一時的に外す：

```csharp
// イベントハンドラーを外す
voiceVoxStyleComboBox.SelectionChanged -= VoiceVoxStyleComboBox_SelectionChanged;

// ComboBoxを更新
voiceVoxStyleComboBox.ItemsSource = styleDisplayItems;
voiceVoxStyleComboBox.SelectedIndex = 0;

// イベントハンドラーを再登録
voiceVoxStyleComboBox.SelectionChanged += VoiceVoxStyleComboBox_SelectionChanged;
```

### 2. DisplayMemberPathの活用

ComboBoxに複雑なオブジェクトを表示する際は`DisplayMemberPath`を使用：

```csharp
voiceVoxStyleComboBox.ItemsSource = styleDisplayItems;
voiceVoxStyleComboBox.DisplayMemberPath = "DisplayName"; // "ノーマル [2]"
```

### 3. 正規表現によるパース

保存された文字列からSpeaker名とStyle IDを抽出：

```csharp
// 入力: "四国めたん (ノーマル) [2]"
var match = Regex.Match(input, @"^(.+?)\s*\(.+?\)\s*\[(\d+)\]$");

// 出力:
// Groups[1] → "四国めたん"
// Groups[2] → "2"
```

### 4. LINQによる検索

選択されたIDに一致するStyleを検索：

```csharp
var matchingItem = styleDisplayItems
    .FirstOrDefault(item => item.Style.Id == selectedStyleId.Value);
```

---

## 🧪 テストシナリオ

### 1. 初回設定

- [x] VoiceVoxを選択
- [x] Speaker一覧が表示される
- [x] 最初のSpeakerが自動選択される
- [x] そのSpeakerのStylesが表示される
- [x] 最初のStyleが自動選択される
- [x] 保存形式 `"Speaker (Style) [ID]"` で保存される

### 2. Speaker変更

- [x] 別のSpeakerを選択
- [x] Styleリストが更新される
- [x] 最初のStyleが自動選択される
- [x] 正しい形式で保存される

### 3. Style変更

- [x] 別のStyleを選択
- [x] 正しい形式で保存される
- [x] SystemConfigに反映される

### 4. 設定の復元

- [x] マスコットを切り替え
- [x] 保存された設定が正しく読み込まれる
- [x] SpeakerとStyleが正しく選択される

### 5. サービス切り替え

- [x] StyleBertVits2 ⇔ VoiceVox の切り替え
- [x] 各サービスの設定が保持される
- [x] UIが正しく表示される

---

## 🎉 まとめ

### 実装内容

1. ✅ **XAML**: voiceVoxStyleComboBox を追加
2. ✅ **コードビハインド**: VoiceVoxStyleDisplayItem クラス追加
3. ✅ **フィールド**: _voiceVoxSpeakers 追加
4. ✅ **UpdateModelAndSpeakerList**: VoiceVox用処理を更新
5. ✅ **VoiceVoxSpeakerComboBox_SelectionChanged**: Style一覧更新処理
6. ✅ **VoiceVoxStyleComboBox_SelectionChanged**: 保存処理（新規）
7. ✅ **LoadMascotVoiceConfig**: イベントハンドラー管理を追加

### 改善効果

- ✅ **直感的なUI**: SpeakerとStyleを段階的に選択
- ✅ **分かりやすい表示**: 日本語ラベルと絞り込み
- ✅ **互換性維持**: 既存の保存形式を維持
- ✅ **拡張性**: 新しいSpeaker/Styleの追加が容易

### ユーザーメリット

- 🎯 **選択が簡単**: 2段階選択で迷わない
- 🎯 **理解しやすい**: キャラクターとスタイルが明確
- 🎯 **効率的**: 関連するStylesのみ表示

---

**実装者**: GitHub Copilot  
**実装日**: 2025年  
**ステータス**: ✅ 完了
