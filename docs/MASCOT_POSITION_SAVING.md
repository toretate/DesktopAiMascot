# マスコット位置保存機能の仕様書

## 📋 概要

デスクトップマスコットの位置を自動的に保存・復元する機能。ユーザーがマウスでマスコットを移動すると、その位置が自動的に保存され、次回起動時に同じ位置に表示されます。

---

## 🎯 機能要件

### 1. 位置の自動保存
- マウスでマスコットウィンドウを移動
- 移動終了後、**1秒後に自動保存**
- 連続的な移動中は保存しない（パフォーマンス最適化）

### 2. 位置の復元
- アプリ起動時に保存された位置を読み込み
- 位置が保存されていない場合は**画面右下**に配置

### 3. 保存先
- **ファイル**: `%APPDATA%\DesktopAiMascot\system_config.yaml`
- **プロパティ**: 
  - `window_position_x`: X座標
  - `window_position_y`: Y座標

---

## 📂 アーキテクチャ

### データフロー

```
[ユーザー操作]
    ↓
[マウスドラッグでウィンドウ移動]
    ↓
[LocationChangedイベント発火]
    ↓
[1秒タイマー開始（連続移動時はリセット）]
    ↓
[タイマー発火 → SaveLocation()]
    ↓
[SystemConfig.WindowPosition に設定]
    ↓
[SystemConfig.Save()]
    ↓
[system_config.yaml に保存]
```

### クラス図

```
┌─────────────────┐
│ MascotWindow    │
├─────────────────┤
│ - locationSave  │
│   Timer         │
├─────────────────┤
│ + LocationChanged│ → 1秒後に位置保存
│ + SaveLocation()│
└────────┬────────┘
         │ uses
         ↓
┌─────────────────┐
│ SystemConfig    │
├─────────────────┤
│ + WindowPosition│
│   X             │
│ + WindowPosition│
│   Y             │
├─────────────────┤
│ + Save()        │
│ + Load()        │
└─────────────────┘
         │ saves to
         ↓
┌─────────────────┐
│ system_config.  │
│ yaml            │
└─────────────────┘
```

---

## 💾 データ構造

### SystemConfig.cs

```csharp
public class SystemConfig
{
    // 位置情報（個別プロパティとしてYAMLシリアライズ可能にする）
    // -1 は「未設定」を表す（デフォルト位置を使用）
    public int WindowPositionX { get; set; } = -1;
    public int WindowPositionY { get; set; } = -1;
    
    // 後方互換性のため内部的にPointとして扱うプロパティ
    [YamlIgnore]
    public Point WindowPosition
    {
        get => new Point(WindowPositionX, WindowPositionY);
        set
        {
            WindowPositionX = value.X;
            WindowPositionY = value.Y;
        }
    }
}
```

### system_config.yaml

```yaml
# 初回起動時（未設定）
window_position_x: -1
window_position_y: -1

# 位置保存後
window_position_x: 2500
window_position_y: 800
```

---

## 🔧 実装詳細

### 1. MascotWindow.xaml.cs

#### フィールド

```csharp
// 位置保存用のタイマー（連続的な位置変更中の保存を避ける）
private DispatcherTimer locationSaveTimer;
```

#### LocationChangedイベント

```csharp
private void MascotWindow_LocationChanged(object sender, EventArgs e)
{
    // 位置変更が連続的に発生するため、タイマーで遅延保存
    // ドラッグ中は何度も発火するが、停止後1秒経過してから保存
    locationSaveTimer?.Stop();
    
    locationSaveTimer = new DispatcherTimer
    {
        Interval = TimeSpan.FromSeconds(1)
    };
    
    locationSaveTimer.Tick += (s, args) =>
    {
        locationSaveTimer.Stop();
        
        var currentLocation = new Point(this.Left, this.Top);
        Debug.WriteLine($"[MascotWindow] 位置が変更されました: ({currentLocation.X}, {currentLocation.Y})");
        SaveLocation(currentLocation);
    };
    
    locationSaveTimer.Start();
}
```

#### 位置の保存

```csharp
private void SaveLocation(Point p)
{
    systemConfig.WindowPosition = new Point((int)p.X, (int)p.Y);
    systemConfig.Save();
    Debug.WriteLine($"Saved location: {p.X},{p.Y}");
}
```

#### 位置の読み込み

```csharp
private Point? LoadSavedLocation()
{
    Point point = systemConfig.WindowPosition;
    
    // -1 は未設定を表す（初回起動時）
    if (point.X >= 0 && point.Y >= 0)
    {
        Debug.WriteLine($"[MascotWindow] 保存された位置を読み込みました: ({point.X}, {point.Y})");
        return new Point(point.X, point.Y);
    }
    
    Debug.WriteLine($"[MascotWindow] 保存された位置がありません。デフォルト位置を使用します。");
    return null;
}
```

#### 起動時の位置設定

```csharp
private void MascotWindow_Loaded(object sender, RoutedEventArgs e)
{
    Point? saved = LoadSavedLocation();
    
    if (saved.HasValue)
    {
        // 保存された位置を使用（画面外にはみ出さないように調整）
        Point loc = saved.Value;
        
        double virtualLeft = SystemParameters.VirtualScreenLeft;
        double virtualTop = SystemParameters.VirtualScreenTop;
        double virtualWidth = SystemParameters.VirtualScreenWidth;
        double virtualHeight = SystemParameters.VirtualScreenHeight;

        if (loc.X < virtualLeft) loc.X = virtualLeft;
        if (loc.Y < virtualTop) loc.Y = virtualTop;
        if (loc.X + this.Width > virtualLeft + virtualWidth) 
            loc.X = virtualLeft + virtualWidth - this.Width;
        if (loc.Y + this.Height > virtualTop + virtualHeight) 
            loc.Y = virtualTop + virtualHeight - this.Height;

        this.Left = loc.X;
        this.Top = loc.Y;
        Debug.WriteLine($"Applied saved location to window: {loc.X},{loc.Y}");
    }
    else
    {
        // デフォルト位置（画面右下）
        var workArea = SystemParameters.WorkArea;
        this.Left = workArea.Right - this.Width;
        this.Top = workArea.Bottom - this.Height;
        Debug.WriteLine($"Applied default location to window: {this.Left},{this.Top}");
    }
}
```

#### 終了時の処理

```csharp
private void MascotWindow_Closing(object sender, CancelEventArgs e)
{
    Debug.WriteLine("[MascotWindow] ========== Closing イベント開始 ==========");
    
    try
    {
        // 位置保存タイマーを停止
        locationSaveTimer?.Stop();
        
        // 最終位置を保存
        var currentLocation = new Point(this.Left, this.Top);
        Debug.WriteLine($"[MascotWindow] 現在の位置: ({currentLocation.X}, {currentLocation.Y})");
        SaveLocation(currentLocation);
    }
    catch (Exception ex)
    {
        Debug.WriteLine($"[MascotWindow] 位置保存エラー: {ex.Message}");
    }
    
    // ... 他のクリーンアップ処理 ...
    
    Debug.WriteLine("[MascotWindow] ========== Closing イベント終了 ==========");
}
```

---

## 🎯 動作フロー

### 初回起動時

```
1. アプリ起動
   ↓
2. SystemConfig.Load()
   ↓
3. window_position_x = -1
   window_position_y = -1
   ↓
4. LoadSavedLocation()
   ↓
5. point.X < 0 → return null
   ↓
6. デフォルト位置（画面右下）に配置
   ↓
7. ユーザーが操作
```

### マスコット移動時

```
1. マウスでウィンドウをドラッグ開始
   ↓
2. LocationChangedイベントが連続的に発火
   例: (100, 100) → (150, 120) → (200, 150) ...
   ↓
3. 各イベントでタイマーをリセット（1秒）
   ↓
4. ドラッグ終了（最終位置: 2500, 800）
   ↓
5. LocationChangedイベントが発火しなくなる
   ↓
6. 1秒後にタイマーが発火
   ↓
7. SaveLocation() が呼ばれる
   ↓
8. SystemConfig.WindowPositionX = 2500
   SystemConfig.WindowPositionY = 800
   ↓
9. SystemConfig.Save()
   ↓
10. system_config.yamlに保存
```

### 次回起動時

```
1. アプリ起動
   ↓
2. SystemConfig.Load()
   ↓
3. window_position_x = 2500
   window_position_y = 800
   ↓
4. LoadSavedLocation()
   ↓
5. point.X >= 0 && point.Y >= 0 → return new Point(2500, 800)
   ↓
6. 画面内に収まるように調整
   ↓
7. Left = 2500, Top = 800 に配置
```

---

## ⚙️ 設定値

### タイマー遅延時間
```csharp
Interval = TimeSpan.FromSeconds(1)
```

**理由**:
- 短すぎる: 連続的な移動中に何度も保存（パフォーマンス低下）
- 長すぎる: 保存されるまで時間がかかる（ユーザー体験低下）
- **1秒**: バランスが良い

### デフォルト値
```csharp
WindowPositionX = -1
WindowPositionY = -1
```

**理由**:
- `-1` は「未設定」を表す特別な値
- `(0, 0)` や `(100, 100)` は実際の座標として使用される可能性がある
- 負の値は画面座標として無効なため、未設定の判定に適している

---

## 🧪 テストシナリオ

### シナリオ1: 初回起動
1. アプリを初めて起動
2. マスコットが画面右下に表示される
3. ログ: `"保存された位置がありません。デフォルト位置を使用します。"`

**期待結果**: ✅ 画面右下に表示

### シナリオ2: 位置を移動して保存
1. マウスでマスコットを任意の位置に移動
2. 1秒待つ
3. ログ: `"位置が変更されました: (X, Y)"` → `"Saved location: X,Y"`
4. `%APPDATA%\DesktopAiMascot\system_config.yaml` を確認
5. `window_position_x: X`, `window_position_y: Y` が保存されている

**期待結果**: ✅ 位置が保存される

### シナリオ3: 保存された位置で起動
1. アプリを終了
2. アプリを再起動
3. 前回終了時の位置にマスコットが表示される
4. ログ: `"保存された位置を読み込みました: (X, Y)"`

**期待結果**: ✅ 保存された位置に表示

### シナリオ4: 連続的な移動
1. マウスでマスコットを素早く何度も移動
2. 移動を停止
3. 1秒後にログ: `"位置が変更されました: (X, Y)"`
4. 1回だけ保存される

**期待結果**: ✅ 最終位置のみ保存

### シナリオ5: 画面外の位置
1. system_config.yamlを編集
2. `window_position_x: 10000`, `window_position_y: 10000` を設定
3. アプリを起動
4. マスコットが画面内に調整されて表示される

**期待結果**: ✅ 画面内に自動調整

### シナリオ6: デバッグ停止
1. Visual Studioでデバッグ実行
2. マスコットを移動
3. 1秒待つ（位置が保存される）
4. Visual Studioのデバッグ停止ボタンで終了
5. アプリを再起動
6. 移動した位置にマスコットが表示される

**期待結果**: ✅ デバッグ停止でも位置が保存されている

---

## 🐛 デバッグ方法

### デバッグ出力の確認

#### 起動時
```
[MascotWindow] 保存された位置を読み込みました: (2500, 800)
Applied saved location to window: 2500,800
```

または

```
[MascotWindow] 保存された位置がありません。デフォルト位置を使用します。
Applied default location to window: 1444,691
```

#### 移動時
```
[MascotWindow] 位置が変更されました: (2500, 800)
Saved location: 2500,800
```

#### 終了時
```
[MascotWindow] ========== Closing イベント開始 ==========
[MascotWindow] 現在の位置: (2500, 800)
Saved location: 2500,800
[MascotWindow] ========== Closing イベント終了 ==========
```

### 設定ファイルの確認

```powershell
# 設定ファイルを表示
Get-Content "$env:APPDATA\DesktopAiMascot\system_config.yaml"

# 位置情報のみ表示
Get-Content "$env:APPDATA\DesktopAiMascot\system_config.yaml" | Select-String -Pattern "window_position"
```

期待される出力:
```yaml
window_position_x: 2500
window_position_y: 800
```

### 設定ファイルのリセット

```powershell
# 設定ファイルを削除（初期化）
Remove-Item "$env:APPDATA\DesktopAiMascot\system_config.yaml"
```

---

## 📊 パフォーマンス

### メモリ使用量
- **タイマーオブジェクト**: ~1KB
- **設定ファイル**: ~2KB (YAML)

### ディスクI/O
- **保存頻度**: 移動終了後1回のみ
- **ファイルサイズ**: ~2KB

### CPU使用率
- **LocationChangedイベント**: 軽量（タイマーのリセットのみ）
- **保存処理**: 軽量（YAML シリアライズ）

---

## 🔒 セキュリティ

### ファイルパス
- `%APPDATA%\DesktopAiMascot\system_config.yaml`
- ユーザーディレクトリ内（他のユーザーからはアクセス不可）

### データ形式
- YAML（プレーンテキスト）
- 位置情報のみ（機密情報なし）

---

## 🚀 今後の拡張性

### 可能な改善
1. **複数ディスプレイ対応**
   - ディスプレイIDも保存
   - ディスプレイ構成変更時の対応

2. **ウィンドウサイズの保存**
   - `WindowWidth`, `WindowHeight` の追加

3. **最小化/最大化状態の保存**
   - `WindowState` の保存

4. **カスタム遅延時間**
   - 設定画面で遅延時間を変更可能に

---

## 📝 変更履歴

### v1.0.0 (2025-01-XX)
- ✅ 初期実装
- ✅ LocationChangedイベントでの自動保存
- ✅ 1秒遅延タイマー
- ✅ デフォルト位置（画面右下）
- ✅ 画面外の位置を画面内に調整
- ✅ デバッグログの追加

---

## 🔗 関連ファイル

- `MascotWindow.xaml.cs` - 位置保存・復元の実装
- `SystemConfig.cs` - 設定データの管理
- `system_config.yaml` - 設定ファイル

---

## 📚 参考

### WPF LocationChangedイベント
- https://docs.microsoft.com/en-us/dotnet/api/system.windows.window.locationchanged

### DispatcherTimer
- https://docs.microsoft.com/en-us/dotnet/api/system.windows.threading.dispatchertimer

### YamlDotNet
- https://github.com/aaubry/YamlDotNet

---

**最終更新**: 2025-01-XX  
**作成者**: GitHub Copilot  
**ステータス**: ✅ 実装完了
