using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using DesktopAiMascot.aiservice.voice;
using DesktopAiMascot.aiservice.voice.schemas;

namespace DesktopAiMascot.aiservice
{
    internal class VoiceAiManager
    {
        private static VoiceAiManager? instance = null;
        public Dictionary<string, AiVoiceServiceBase> VoiceAiServices { get; private set; } = new Dictionary<string, AiVoiceServiceBase>();
        public AiVoiceServiceBase? CurrentService { get; set; } = null;
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

            name = "StyleBertVits2";
            VoiceAiServices.Add(name, new StyleBertVits2Service());
            
            name = "VoiceVox";
            VoiceAiServices.Add(name, new VoiceVoxService());
        }

        public void Load()
        {
            string currentVoice = SystemConfig.Instance.VoiceService;
            if (VoiceAiServices.TryGetValue(currentVoice, out var service))
            {
                CurrentService = service;
                
                if (!string.IsNullOrEmpty(SystemConfig.Instance.VoiceServiceModel))
                {
                    service.Model = SystemConfig.Instance.VoiceServiceModel;
                }
                if (!string.IsNullOrEmpty(SystemConfig.Instance.VoiceServiceSpeaker))
                {
                    service.Speaker = SystemConfig.Instance.VoiceServiceSpeaker;
                }
            }
        }
    }
}
