using Xunit;
using DesktopAiMascot.mascots;
using DesktopAiMascot.aiservice.chat;
using System;
using System.Diagnostics;
using System.Collections.Generic;
using System.Linq;

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
        /// </summary>
        private bool IsLocalTestEnvironment => 
            !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("MASCOT_TEST_LOCAL"));

        /// <summary>
        /// テスト対象マスコットを取得
        /// </summary>
        private List<string> GetTargetMascots() => MascotTestHelper.GetTargetMascots();

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
                var isPublic = MascotTestHelper.PublicMascots.Contains(kvp.Key) ? "(公開)" : "(プライベート)";
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
            
            var prompt = model.Prompt;
            var characterName = model.Config.SystemPrompt.Profile.Name;
            
            Assert.True(
                prompt.Contains(characterName) || prompt.Contains("キャラクター名:"),
                $"プロンプトにキャラクター情報が含まれていません。キャラクター名: {characterName}"
            );
            
            Debug.WriteLine($"[{mascotName}] プロンプトにキャラクター情報が含まれていることを確認しました");
        }

        /// <summary>
        /// Theory テスト用のマスコットリスト取得メソッド
        /// </summary>
        public static IEnumerable<object[]> GetTargetMascotsForTheory() => MascotTestHelper.GetTargetMascotsForTheory();
    }
}
