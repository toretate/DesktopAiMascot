using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Dynamic;
using System.Diagnostics;

using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace DesktopAiMascot.mascots
{
    /**
     * マスコットを管理するクラス
     * シングルトンクラスとして実装
     */
    internal class MascotManager
    {
        private static MascotManager? instance = null;

        public Dictionary<string, MascotModel> MascotModels { get; private set; } = new Dictionary<string, MascotModel>();
        public MascotModel? CurrentModel { get; set; } = null;

        public static MascotManager Instance
        {
            get
            {
                if (instance == null)
                {
                    instance = new MascotManager();
                }
                return instance;
            }
        }        

        public MascotModel? GetMascotByName(string name)
        {
            if (MascotModels.TryGetValue(name, out var model))
            {
                return model;
            }
            return null;
        }

        /**
         * assets/mascots/ 以下のマスコットデータを読み込む
         * mascotsフォルダ内にマスコットごとのサブフォルダがあり、config.yaml でマスコットの設定を読み込む
         */
        public void Load()
        {
            // mascots フォルダ内の config.yaml を読み込んで MascotModel を生成し、リストに追加する
            MascotModels.Clear();

            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string mascotsDir = Path.Combine(baseDir, "assets", "mascots");
                if (!Directory.Exists(mascotsDir)) return;

                // parsing is delegated to MascotConfigParser

                var imageExt = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".png", ".jpg", ".jpeg", ".gif", ".webp" };

                foreach (var dir in Directory.GetDirectories(mascotsDir))
                {
                    try
                    {
                        string configPath = Path.Combine(dir, "config.yaml");
                        string name = Path.GetFileName(dir);
                        string prompt = string.Empty;

                        if (File.Exists(configPath))
                        {
                            string yaml = File.ReadAllText(configPath);
                            var parsed = MascotConfigIO.ParseFromYaml(yaml, name);
                            name = parsed.Name;
                            prompt = parsed.Prompt;
                        }

                        // Collect image files in the mascot folder. Store paths relative to application base
                        var images = Directory.GetFiles(dir)
                            .Where(p => imageExt.Contains(Path.GetExtension(p)))
                            .OrderBy(p => p)
                            .Select(p => Path.GetRelativePath(baseDir, p))
                            .ToArray();

                        MascotModels.Add(name, new MascotModel(name, prompt ?? string.Empty, images));
                    }
                    catch (Exception ex)
                    {
                        // ignore individual mascot load errors but write to console for debugging
                        Debug.WriteLine($"Failed to load mascot from '{dir}': {ex.Message}");
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"MascotManager.Load error: {ex.Message}");
            }
        }

    }
}
