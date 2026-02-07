using Xunit;
using DesktopAiMascot.mascots;
using DesktopAiMascot.aiservice.chat;
using System;
using System.Diagnostics;
using System.Collections.Generic;
using System.Linq;
using System.IO;

namespace DesktopAiMascotTest.mascots
{
    /// <summary>
    /// MascotManager のテスト - 全マスコットが正しくロードされるか確認
    /// プライベートマスコットはローカルでのみテスト実行
    /// </summary>
    public class MascotManagerTests
    {
        /// <summary>
        /// ローカル環境でのテストかどうかを判定
        /// 環境変数 "MASCOT_TEST_LOCAL" が設定されている場合、プライベートマスコットもテスト対象
        /// </summary>
        private bool IsLocalTestEnvironment => 
            !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("MASCOT_TEST_LOCAL"));

        /// <summary>
        /// 公開マスコット（GitHub で公開しているもの）を定義
        /// </summary>
        private static readonly HashSet<string> PublicMascots = new(StringComparer.OrdinalIgnoreCase)
        {
            "default"
        };

        /// <summary>
        /// assets/mascots フォルダから存在するすべてのマスコットを取得
        /// </summary>
        private static List<string> GetAvailableMascots()
        {
            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            var mascotsDir = Path.Combine(baseDir, "assets", "mascots");

            if (!Directory.Exists(mascotsDir))
            {
                return new List<string>();
            }

            return Directory.GetDirectories(mascotsDir)
                .Select(dir => Path.GetFileName(dir))
                .Where(name => !string.IsNullOrEmpty(name))
                .ToList();
        }

        /// <summary>
        /// テスト対象マスコットを取得
        /// ローカルテストの場合はすべてを対象、CI環境では公開マスコット（default）のみ
        /// </summary>
        private string[] GetTargetMascots()
        {
            var availableMascots = GetAvailableMascots();

            if (IsLocalTestEnvironment)
            {
                // ローカル環境：存在するすべてのマスコットをテスト対象
                return availableMascots.OrderBy(m => m).ToArray();
            }
            else
            {
                // CI環境：公開マスコットのみ
                return availableMascots
                    .Where(m => PublicMascots.Contains(m))
                    .OrderBy(m => m)
                    .ToArray();
            }
        }

        [Fact]
        public void Load_すべてのマスコットがロードされる()
        {
            // Arrange
            var manager = new MascotManager();

            // Act
            manager.Load();

            // Assert
            Assert.NotEmpty(manager.MascotModels);
            
            // テスト対象マスコットが存在するはず
            var expectedMascots = GetTargetMascots();
            foreach (var mascotName in expectedMascots)
            {
                Assert.True(manager.MascotModels.ContainsKey(mascotName), 
                    $"マスコット「{mascotName}」がロードされていません");
            }
            
            Debug.WriteLine($"ロードされたマスコット数: {manager.MascotModels.Count}");
            foreach (var kvp in manager.MascotModels.OrderBy(x => x.Key))
            {
                var isPublic = PublicMascots.Contains(kvp.Key) ? "(公開)" : "(プライベート)";
                Debug.WriteLine($"  - {kvp.Key} {isPublic}");
            }
        }

        [Theory]
        [MemberData(nameof(GetTargetMascotsForTheory))]
        public void Load_マスコットのPromptが空でない(string mascotName)
        {
            // Arrange
            var manager = new MascotManager();
            manager.Load();

            // Act
            var model = manager.GetMascotByName(mascotName);

            // Assert
            Assert.NotNull(model);
            Assert.NotEmpty(model.Prompt);
            
            Debug.WriteLine($"[{mascotName}] プロンプト長: {model.Prompt.Length}");
            Debug.WriteLine($"[{mascotName}] プロンプト (最初の200文字): {model.Prompt.Substring(0, Math.Min(200, model.Prompt.Length))}");
        }

        [Theory]
        [MemberData(nameof(GetTargetMascotsForTheory))]
        public void Load_マスコットのConfigが解析されている(string mascotName)
        {
            // Arrange
            var manager = new MascotManager();
            manager.Load();

            // Act
            var model = manager.GetMascotByName(mascotName);

            // Assert
            Assert.NotNull(model);
            Assert.NotNull(model.Config);
            Assert.NotNull(model.Config.SystemPrompt);
            Assert.NotEmpty(model.Config.SystemPrompt.Profile.Name);
            
            Debug.WriteLine($"[{mascotName}] キャラクター名: {model.Config.SystemPrompt.Profile.Name}");
        }

        [Theory]
        [MemberData(nameof(GetTargetMascotsForTheory))]
        public void Load_マスコットのPromptにキャラクター情報が含まれている(string mascotName)
        {
            // Arrange
            var manager = new MascotManager();
            manager.Load();

            // Act
            var model = manager.GetMascotByName(mascotName);

            // Assert
            Assert.NotNull(model);
            
            // プロンプトにはキャラクター名が含まれるはず
            var prompt = model.Prompt;
            var characterName = model.Config.SystemPrompt.Profile.Name;
            
            // キャラクター名がプロンプトに含まれることを確認
            // または、"キャラクター名:" というテキストが含まれることを確認
            Assert.True(
                prompt.Contains(characterName) || prompt.Contains("キャラクター名:"),
                $"プロンプトにキャラクター情報が含まれていません。キャラクター名: {characterName}"
            );
            
            Debug.WriteLine($"[{mascotName}] プロンプトにキャラクター情報が含まれていることを確認しました");
        }

        /// <summary>
        /// Theory テスト用のマスコットリスト取得メソッド
        /// 実行時に assets/mascots フォルダをスキャンして、テスト対象マスコットを取得
        /// </summary>
        public static IEnumerable<object[]> GetTargetMascotsForTheory()
        {
            var isLocal = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("MASCOT_TEST_LOCAL"));
            var availableMascots = GetAvailableMascots();

            IEnumerable<string> targetMascots;

            if (isLocal)
            {
                // ローカル環境：存在するすべてのマスコットをテスト対象
                targetMascots = availableMascots.OrderBy(m => m);
            }
            else
            {
                // CI環境：公開マスコットのみ
                targetMascots = availableMascots
                    .Where(m => PublicMascots.Contains(m))
                    .OrderBy(m => m);
            }

            return targetMascots.Select(m => new object[] { m });
        }
    }
}
