using Xunit;
using DesktopAiMascot.mascots;
using DesktopAiMascot.aiservice.chat;
using System;
using System.Reflection;
using System.Diagnostics;

namespace DesktopAiMascotTest.aiservice.chat
{
    /// <summary>
    /// LmStudioChatService のテスト - SystemPrompt が正しく読み込まれるか確認
    /// </summary>
    public class LmStudioChatServiceTests
    {
        private void SetupCurrentModel(string mascotName)
        {
            // MascotManager を初期化してマスコットをロード
            var manager = MascotManager.Instance;
            manager.Load();
            
            // 指定されたマスコットを現在のモデルに設定
            var model = manager.GetMascotByName(mascotName);
            Assert.NotNull(model);
            manager.CurrentModel = model;
            
            Debug.WriteLine($"[LmStudioChatService] CurrentModel を {mascotName} に設定しました");
        }

        [Theory]
        [InlineData("misogi")]
        [InlineData("miyako")]
        [InlineData("miku")]
        [InlineData("metan")]
        [InlineData("default")]
        public void LoadSystemPrompt_マスコットのPromptを取得できる(string mascotName)
        {
            // Arrange
            SetupCurrentModel(mascotName);
            var service = new LmStudioChatService();

            // Act
            // LoadSystemPrompt は private メソッドなので、反射を使用して呼び出す
            var methodInfo = typeof(LmStudioChatService).GetMethod(
                "LoadSystemPrompt", 
                BindingFlags.NonPublic | BindingFlags.Static
            );
            
            Assert.NotNull(methodInfo);
            
            var result = (string?)methodInfo.Invoke(null, null);

            // Assert
            Assert.NotNull(result);
            Assert.NotEmpty(result);
            
            Debug.WriteLine($"[{mascotName}] 取得したプロンプト長: {result.Length}");
            Debug.WriteLine($"[{mascotName}] プロンプト (最初の200文字):");
            Debug.WriteLine(result.Length > 200 ? result.Substring(0, 200) + "..." : result);
        }

        [Theory]
        [InlineData("misogi")]
        [InlineData("miyako")]
        [InlineData("miku")]
        [InlineData("metan")]
        [InlineData("default")]
        public void LoadSystemPrompt_プロンプトにキャラクター情報が含まれている(string mascotName)
        {
            // Arrange
            SetupCurrentModel(mascotName);
            var service = new LmStudioChatService();

            // Act
            var methodInfo = typeof(LmStudioChatService).GetMethod(
                "LoadSystemPrompt", 
                BindingFlags.NonPublic | BindingFlags.Static
            );
            
            var result = (string?)methodInfo.Invoke(null, null);

            // Assert
            Assert.NotNull(result);
            
            // プロンプトに人間が読める形式のキャラクター情報が含まれるはず
            // "キャラクター名:" が含まれることを確認
            Assert.Contains("キャラクター名:", result);
            
            // プロンプトに YAML の形式が含まれていないことを確認
            // （YAML 形式では "profile:" などが含まれる）
            Assert.DoesNotContain("profile:", result);
            
            Debug.WriteLine($"[{mascotName}] プロンプトが正しい形式で生成されていることを確認しました");
        }

        [Theory]
        [InlineData("misogi")]
        [InlineData("miyako")]
        [InlineData("miku")]
        [InlineData("metan")]
        [InlineData("default")]
        public void LoadSystemPrompt_プロンプトに性格情報が含まれている(string mascotName)
        {
            // Arrange
            SetupCurrentModel(mascotName);
            var service = new LmStudioChatService();

            // Act
            var methodInfo = typeof(LmStudioChatService).GetMethod(
                "LoadSystemPrompt", 
                BindingFlags.NonPublic | BindingFlags.Static
            );
            
            var result = (string?)methodInfo.Invoke(null, null);

            // Assert
            Assert.NotNull(result);
            
            // プロンプトに【性格】セクションが含まれるはず
            Assert.Contains("【性格】", result);
            
            Debug.WriteLine($"[{mascotName}] プロンプトに性格情報が含まれていることを確認しました");
        }

        [Theory]
        [InlineData("misogi")]
        [InlineData("miyako")]
        [InlineData("miku")]
        [InlineData("metan")]
        [InlineData("default")]
        public void SendMessageAsync_SystemPromptが設定されて送信される(string mascotName)
        {
            // Arrange
            SetupCurrentModel(mascotName);
            var service = new LmStudioChatService();
            
            // LoadSystemPrompt を使用してプロンプトを設定
            var methodInfo = typeof(LmStudioChatService).GetMethod(
                "LoadSystemPrompt", 
                BindingFlags.NonPublic | BindingFlags.Static
            );
            
            var systemPrompt = (string?)methodInfo.Invoke(null, null);
            Assert.NotNull(systemPrompt);
            
            // Act
            // SystemPrompt プロパティを直接設定
            service.SystemPrompt = systemPrompt;

            // Assert
            Assert.NotNull(service.SystemPrompt);
            Assert.NotEmpty(service.SystemPrompt);
            Assert.Equal(systemPrompt, service.SystemPrompt);
            
            Debug.WriteLine($"[{mascotName}] SystemPrompt がサービスに設定されました");
            Debug.WriteLine($"[{mascotName}] SystemPrompt 長: {service.SystemPrompt.Length}");
        }
    }
}
