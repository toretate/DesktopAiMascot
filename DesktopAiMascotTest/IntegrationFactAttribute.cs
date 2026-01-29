using System;
using Xunit;

namespace DesktopAiMascotTest
{
    /// <summary>
    /// 統合テスト用のカスタムFact属性
    /// 環境変数 "RUN_INTEGRATION_TESTS" が "true" の場合のみテストを実行します
    /// それ以外の場合は自動的にスキップされます
    /// </summary>
    public sealed class IntegrationFactAttribute : FactAttribute
    {
        private const string SKIP_MESSAGE = "統合テスト: 実行するには環境変数 RUN_INTEGRATION_TESTS=true を設定してください";

        public IntegrationFactAttribute()
        {
            // 環境変数をチェック
            var runIntegrationTests = Environment.GetEnvironmentVariable("RUN_INTEGRATION_TESTS");
            
            // "true" でない場合はスキップ
            if (!string.Equals(runIntegrationTests, "true", StringComparison.OrdinalIgnoreCase))
            {
                //Skip = SKIP_MESSAGE;

            }
        }
    }
}
