using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace DesktopAiMascotTest.mascots
{
    /// <summary>
    /// マスコットテスト共通ユーティリティ
    /// ローカル/CI環境でのテスト対象マスコット管理
    /// </summary>
    internal static class MascotTestHelper
    {
        /// <summary>
        /// 公開マスコット（GitHub で公開しているもの）を定義
        /// </summary>
        public static readonly HashSet<string> PublicMascots = new(StringComparer.OrdinalIgnoreCase)
        {
            "default"
        };

        /// <summary>
        /// assets/mascots フォルダから存在するすべてのマスコットを取得
        /// </summary>
        public static List<string> GetAvailableMascots()
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
        public static List<string> GetTargetMascots()
        {
            var isLocal = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("MASCOT_TEST_LOCAL"));
            var availableMascots = GetAvailableMascots();

            if (isLocal)
            {
                // ローカル環境：存在するすべてのマスコットをテスト対象
                return availableMascots.OrderBy(m => m).ToList();
            }
            else
            {
                // CI環境：公開マスコットのみ
                return availableMascots
                    .Where(m => PublicMascots.Contains(m))
                    .OrderBy(m => m)
                    .ToList();
            }
        }

        /// <summary>
        /// Theory テスト用のマスコットリスト取得メソッド
        /// </summary>
        public static IEnumerable<object[]> GetTargetMascotsForTheory()
        {
            var targetMascots = GetTargetMascots();
            return targetMascots.Select(m => new object[] { m });
        }
    }
}
