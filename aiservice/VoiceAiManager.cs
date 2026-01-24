using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DesktopAiMascot.aiservice
{
    class VoiceAi
    {
        public string Name { get; set; } = string.Empty;
        public string EndPoint { get; set; } = string.Empty;
        public string ApiKey { get; set; } = string.Empty;

    }

    internal class VoiceAiManager
    {
        private static VoiceAiManager? instance = null;
        public Dictionary<string, VoiceAi> VoiceAiServices { get; private set; } = new Dictionary<string, VoiceAi>();
        public VoiceAi? CurrentService { get; set; } = null;
        public static VoiceAiManager Instance
        {
            get
            {
                if (instance == null)
                {
                    instance = new VoiceAiManager();
                }
                return instance;
            }
        }

        VoiceAiManager()
        {
            string name = String.Empty;

            name = "Style Bert Vits 2";
            VoiceAiServices.Add(name, new VoiceAi
            {
                Name = name,
                EndPoint = "http://127.0.0.1:8080/voice",
            });

            name = "Aivis Speech";
            VoiceAiServices.Add(name, new VoiceAi
            {
                Name = name,
                EndPoint = "http://127.0.0.1:8080/voice",
            });

            name = "Fish Speech";
            VoiceAiServices.Add(name, new VoiceAi
            {
                Name = name,
                EndPoint = "http://127.0.0.1:8080/voice",
            });
        }

        public void Load()
        {
        }
    }
}
