# Desktop Mascot

A simple desktop mascot application built with C# and Windows Forms.

## Features

- Runs in the system tray
- Animated mascot on the desktop
- Context menu to show/hide/exit
- Draggable mascot

## Requirements

- .NET 8.0 or later
- Windows OS

## Project Structure

- `Program.cs`: Application entry point
- `MascotForm.cs`: Main form handling UI and tray icon
- `Mascot.cs`: Mascot logic including animation and interaction

## Requirements

- .NET 8.0 or later
- Windows OS

## ビルドと実行方法

1. Visual Studio または C# 拡張機能がインストールされた VS Code でプロジェクトを開きます。
2. 必要に応じて NuGet パッケージを復元します。
3. プロジェクトをビルドします。
4. 実行可能ファイルを起動します。

### Visual Studio での実行
- `DesktopAiMascot.sln` を Visual Studio で開きます。
- F5 キーを押すか、実行ボタンをクリックしてデバッグモードで起動できます。

### VS Code での実行
- F5 キーを押すか、実行ボタンをクリックしてデバッグモードで起動できます。
- ビルドタスクが自動的に実行されます。

## Customization

- Add mascot image: Place a PNG or WebP file named `mascot1.png` or `mascot1.webp` in the `images` folder for the static mascot image.
- Replace the animation in `OnPaint` with actual images.
- Add more features like interaction, sound, etc.