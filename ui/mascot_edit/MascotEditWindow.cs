using Godot;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using DesktopAiMascot.mascots;
using DesktopAiMascot.utils;
using Button = Godot.Button;

namespace DesktopAiMascot.ui.mascot_edit
{
    /// <summary>
    /// マスコット編集ウィンドウ
    /// </summary>
    public partial class MascotEditWindow : Window
    {
        private MascotModel _mascotModel = null!;
        private string _mascotDirectory = string.Empty;
        private List<MascotImageSet> _imageItems = new List<MascotImageSet>();

        private TextureRect _coverTextureRect = null!;
        private ItemList _imageList = null!;
        private MascotEditSettingControl _settingControl = null!;
        private Button _saveButton = null!;
        private Button _cancelButton = null!;

        public override void _Ready()
        {
            Debug.WriteLine("[MascotEditWindow] _Ready() 開始");
            
            try
            {
                // ノードツリーをダンプ
                Debug.WriteLine("[MascotEditWindow] ========== ノードツリーダンプ開始 ==========");
                PrintNodeTree(this, 0);
                Debug.WriteLine("[MascotEditWindow] ========== ノードツリーダンプ終了 ==========");
                
                _coverTextureRect = GetNode<TextureRect>("%CoverTextureRect");
                Debug.WriteLine($"[MascotEditWindow] _coverTextureRect: {(_coverTextureRect != null ? "OK" : "NULL")}");
                
                _imageList = GetNode<ItemList>("%ImageList");
                Debug.WriteLine($"[MascotEditWindow] _imageList: {(_imageList != null ? "OK" : "NULL")}");
                
                // 通常のパスで取得を試みる
                var settingControlPath = "MarginContainer/VBoxContainer/MainPanel/HBoxContainer/RightPanel/SettingControl";
                Debug.WriteLine($"[MascotEditWindow] SettingControl取得を試みます: {settingControlPath}");
                
                var settingControlNode = GetNodeOrNull(settingControlPath);
                Debug.WriteLine($"[MascotEditWindow] settingControlNode (通常パス): {settingControlNode?.GetType().Name ?? "NULL"}");
                
                if (settingControlNode != null)
                {
                    _settingControl = settingControlNode as MascotEditSettingControl;
                    Debug.WriteLine($"[MascotEditWindow] キャスト結果: {(_settingControl != null ? "OK" : "FAILED")}");
                    
                    if (_settingControl == null)
                    {
                        Debug.WriteLine($"[MascotEditWindow] 実際の型: {settingControlNode.GetType().FullName}");
                    }
                }
                
                // unique_name_in_ownerでも試す
                if (_settingControl == null)
                {
                    Debug.WriteLine("[MascotEditWindow] unique_name_in_ownerで再取得を試みます");
                    var uniqueNode = GetNodeOrNull("%SettingControl");
                    Debug.WriteLine($"[MascotEditWindow] uniqueNode: {uniqueNode?.GetType().Name ?? "NULL"}");
                    
                    if (uniqueNode != null)
                    {
                        _settingControl = uniqueNode as MascotEditSettingControl;
                        Debug.WriteLine($"[MascotEditWindow] unique経由のキャスト: {(_settingControl != null ? "OK" : "FAILED")}");
                    }
                }
                
                // 手動インスタンス化を試みる
                if (_settingControl == null)
                {
                    Debug.WriteLine("[MascotEditWindow] 手動インスタンス化を試みます");
                    try
                    {
                        var settingControlScene = GD.Load<PackedScene>("res://ui/mascot_edit/MascotEditSettingControl.tscn");
                        if (settingControlScene != null)
                        {
                            Debug.WriteLine("[MascotEditWindow] シーンのロードに成功");
                            _settingControl = settingControlScene.Instantiate<MascotEditSettingControl>();
                            Debug.WriteLine($"[MascotEditWindow] インスタンス化結果: {(_settingControl != null ? "OK" : "NULL")}");
                            
                            if (_settingControl != null)
                            {
                                // RightPanelに追加
                                var rightPanel = GetNode<MarginContainer>("MarginContainer/VBoxContainer/MainPanel/HBoxContainer/RightPanel");
                                if (rightPanel != null)
                                {
                                    rightPanel.AddChild(_settingControl);
                                    _settingControl.Name = "SettingControl";
                                    Debug.WriteLine("[MascotEditWindow] RightPanelに追加しました");
                                }
                                else
                                {
                                    Debug.WriteLine("[MascotEditWindow] エラー: RightPanelが見つかりません");
                                }
                            }
                        }
                        else
                        {
                            Debug.WriteLine("[MascotEditWindow] エラー: シーンのロードに失敗");
                        }
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine($"[MascotEditWindow] 手動インスタンス化エラー: {ex.Message}");
                    }
                }
                
                Debug.WriteLine($"[MascotEditWindow] _settingControl 最終結果: {(_settingControl != null ? "OK" : "NULL")}");
                
                _saveButton = GetNode<Button>("%SaveButton");
                Debug.WriteLine($"[MascotEditWindow] _saveButton: {(_saveButton != null ? "OK" : "NULL")}");
                
                _cancelButton = GetNode<Button>("%CancelButton");
                Debug.WriteLine($"[MascotEditWindow] _cancelButton: {(_cancelButton != null ? "OK" : "NULL")}");

                Debug.WriteLine("[MascotEditWindow] ノード取得完了");

                if (_imageList != null)
                    _imageList.ItemSelected += OnImageSelected;
                if (_saveButton != null)
                    _saveButton.Pressed += OnSaveButtonPressed;
                if (_cancelButton != null)
                    _cancelButton.Pressed += OnCancelButtonPressed;

                CloseRequested += () => QueueFree();
                
                Debug.WriteLine("[MascotEditWindow] _Ready() 完了");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditWindow] _Ready() エラー: {ex.Message}");
                Debug.WriteLine($"[MascotEditWindow] スタックトレース: {ex.StackTrace}");
                GD.PrintErr($"_Ready() エラー: {ex.Message}");
            }
        }

        private void PrintNodeTree(Node node, int depth)
        {
            string indent = new string(' ', depth * 2);
            Debug.WriteLine($"{indent}- {node.Name} ({node.GetType().Name})");
            
            for (int i = 0; i < node.GetChildCount(); i++)
            {
                PrintNodeTree(node.GetChild(i), depth + 1);
            }
        }

        /// <summary>
        /// MascotModelを設定して初期化
        /// </summary>
        public void Initialize(MascotModel mascotModel)
        {
            Debug.WriteLine("[MascotEditWindow] Initialize() 開始");
            
            _mascotModel = mascotModel;
            _mascotDirectory = _mascotModel.DirectoryPath;

            Debug.WriteLine($"[MascotEditWindow] MascotModel.DirectoryPath から取得: {_mascotDirectory}");
            Debug.WriteLine($"[MascotEditWindow] ディレクトリ存在確認: {Directory.Exists(_mascotDirectory)}");

            if (string.IsNullOrEmpty(_mascotDirectory))
            {
                Debug.WriteLine($"[MascotEditWindow] エラー: MascotModel.DirectoryPath が空です");
                GD.PrintErr("MascotModel.DirectoryPath が空です");
                return;
            }

            // _Ready()が完了してから初期化処理を実行
            Debug.WriteLine("[MascotEditWindow] CallDeferred を実行");
            CallDeferred(nameof(InitializeDeferred));
            Debug.WriteLine("[MascotEditWindow] Initialize() 完了");
        }

        private void InitializeDeferred()
        {
            Debug.WriteLine("[MascotEditWindow] InitializeDeferred() 開始");
            
            try
            {
                _settingControl.Initialize(_mascotModel);
                _settingControl.RequestReloadImageList += OnRequestReloadImageList;

                LoadMascotData();
                
                Debug.WriteLine("[MascotEditWindow] InitializeDeferred() 完了");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditWindow] InitializeDeferred エラー: {ex.Message}");
                Debug.WriteLine($"[MascotEditWindow] スタックトレース: {ex.StackTrace}");
                GD.PrintErr($"InitializeDeferred エラー: {ex.Message}");
            }
        }

        /// <summary>
        /// マスコットデータを読み込む
        /// </summary>
        private void LoadMascotData()
        {
            try
            {
                Debug.WriteLine($"[MascotEditWindow] ========== マスコットデータ読み込み開始 ==========");
                Debug.WriteLine($"[MascotEditWindow] マスコット名: {_mascotModel.Name}");

                LoadCoverImage();
                LoadImageList();

                Debug.WriteLine($"[MascotEditWindow] ========== マスコットデータ読み込み完了 ==========");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditWindow] データ読み込みエラー: {ex.Message}");
                Debug.WriteLine($"[MascotEditWindow] スタックトレース: {ex.StackTrace}");
                GD.PrintErr($"マスコットデータの読み込みに失敗しました。\n{ex.Message}");
            }
        }

        /// <summary>
        /// カバー画像を読み込む（cover.png固定）
        /// </summary>
        private void LoadCoverImage()
        {
            try
            {
                string coverPath = Path.Combine(_mascotDirectory, "cover.png");

                Debug.WriteLine($"[MascotEditWindow] カバー画像パス: {coverPath}");

                if (File.Exists(coverPath))
                {
                    var texture = ImageLoadHelper.LoadGodotTexture(coverPath);
                    if (texture != null)
                    {
                        _coverTextureRect.Texture = texture;
                        Debug.WriteLine("[MascotEditWindow] カバー画像を読み込みました");
                    }
                    else
                    {
                        Debug.WriteLine("[MascotEditWindow] カバー画像の読み込みに失敗しました");
                    }
                }
                else
                {
                    Debug.WriteLine("[MascotEditWindow] カバー画像（cover.png）が見つかりません");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditWindow] カバー画像読み込みエラー: {ex.Message}");
            }
        }

        /// <summary>
        /// 画像一覧を読み込み、セットにグループ化する
        /// </summary>
        private void LoadImageList()
        {
            try
            {
                _imageItems.Clear();
                _imageList.Clear();

                if (!Directory.Exists(_mascotDirectory))
                {
                    Debug.WriteLine($"[MascotEditWindow] マスコットディレクトリが存在しません: {_mascotDirectory}");
                    return;
                }

                Debug.WriteLine($"[MascotEditWindow] 画像一覧を読み込み中: {_mascotDirectory}");

                var allFiles = Directory.GetFiles(_mascotDirectory);
                var imageItems = ImageLoadHelper.LoadImages(_mascotModel.Name, allFiles);

                // 画像セットのディクショナリ (Key: SetName)
                var imageSets = new Dictionary<string, MascotImageSet>();

                foreach (var item in imageItems)
                {
                    string fileName = Path.GetFileNameWithoutExtension(item.FileName);

                    string setName = fileName;
                    string suffix = "";
                    string type = "main"; // main, angle, pose, emotion

                    // サフィックスの判定
                    if (fileName.Contains("_"))
                    {
                        var parts = fileName.Split('_');
                        string lastPart = parts.Last().ToLower();

                        // 角度サフィックス
                        var angleSuffixes = new[] { "left", "right", "front", "back", "top", "bottom", "above", "below", "behind" };
                        if (angleSuffixes.Contains(lastPart))
                        {
                            setName = string.Join("_", parts.Take(parts.Length - 1));
                            suffix = lastPart;
                            type = "angle";
                        }
                    }

                    if (!imageSets.ContainsKey(setName))
                    {
                        imageSets[setName] = new MascotImageSet(setName);
                    }

                    var currentSet = imageSets[setName];

                    switch (type)
                    {
                        case "angle":
                            currentSet.AngleImages[suffix] = item;
                            break;

                        case "main":
                        default:
                            if (currentSet.Image == null)
                            {
                                currentSet.Image = item;
                            }
                            else
                            {
                                currentSet.Image = item;
                            }
                            break;
                    }
                }

                // セットをリストに追加 (Imageがnullでないもの、またはAngleImagesがあるもの)
                var sortedSets = imageSets.Values
                    .Where(s => s.Image != null || s.AngleImages.Count > 0)
                    .OrderBy(s => s.Name.Equals("cover", StringComparison.OrdinalIgnoreCase) ? "" : s.Name)
                    .ToList();

                foreach (var set in sortedSets)
                {
                    // 暫定対応: ImageがnullならAngleImagesの最初のものをImageに入れておく
                    if (set.Image == null && set.AngleImages.Count > 0)
                    {
                        set.Image = set.AngleImages.Values.First();
                    }

                    _imageItems.Add(set);
                }

                // ItemListに追加
                _imageList.FixedIconSize = new Vector2I(120, 120);
                foreach (var imageSet in _imageItems)
                {
                    if (imageSet.Image?.ImageSource != null)
                    {
                        _imageList.AddItem(imageSet.Name);
                        var texture = ImageLoadHelper.LoadGodotTexture(imageSet.Image.ImagePath);
                        if (texture != null)
                        {
                            _imageList.SetItemIcon(_imageList.ItemCount - 1, texture);
                        }
                    }
                }

                Debug.WriteLine($"[MascotEditWindow] {_imageItems.Count}個の画像セットをItemListに設定しました");

            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditWindow] 画像一覧読み込みエラー: {ex.Message}");
                Debug.WriteLine($"[MascotEditWindow] スタックトレース: {ex.StackTrace}");
            }
        }

        /// <summary>
        /// 画像選択変更イベント
        /// </summary>
        private void OnImageSelected(long index)
        {
            if (index >= 0 && index < _imageItems.Count)
            {
                _settingControl.SelectedMascotImageSet = _imageItems[(int)index];
            }
            else
            {
                _settingControl.SelectedMascotImageSet = null;
            }
        }

        /// <summary>
        /// 画像リスト再読み込みリクエスト
        /// </summary>
        private void OnRequestReloadImageList()
        {
            LoadImageList();
        }

        /// <summary>
        /// 保存ボタン
        /// </summary>
        private void OnSaveButtonPressed()
        {
            try
            {
                // 表示名が変更された場合の処理
                string newName = _settingControl.GetDisplayName();

                if (string.IsNullOrEmpty(newName))
                {
                    GD.PrintErr("表示名を入力してください。");
                    return;
                }

                // システムプロンプトを保存
                _settingControl.SaveConfig();

                Debug.WriteLine($"[MascotEditWindow] マスコット情報を保存しました: {newName}");
                GD.Print("マスコット情報を保存しました。");

                QueueFree();
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[MascotEditWindow] 保存エラー: {ex.Message}");
                GD.PrintErr($"保存に失敗しました。\n{ex.Message}");
            }
        }

        /// <summary>
        /// キャンセルボタン
        /// </summary>
        private void OnCancelButtonPressed()
        {
            QueueFree();
        }
    }
}
