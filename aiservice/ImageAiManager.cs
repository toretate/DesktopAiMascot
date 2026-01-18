using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DesktopAiMascot.aiservice
{
    class ImageAi
    {
        public string Name { get; set; } = string.Empty;
        public string EndPoint { get; set; } = string.Empty;
        public string ApiKey { get; set; } = string.Empty;

    }

    internal class ImageAiManager
    {
        private static ImageAiManager? instance = null;
        public Dictionary<string, ImageAi> ImageAiServices { get; private set; } = new Dictionary<string, ImageAi>();
        public ImageAi? CurrentService { get; set; } = null;
        public static ImageAiManager Instance
        {
            get
            {
                if (instance == null)
                {
                    instance = new ImageAiManager();
                }
                return instance;
            }
        }

        ImageAiManager()
        {
            string name = String.Empty;

            name = "ComfyUI";
            ImageAiServices.Add(name, new ImageAi
            {
                Name = name,
                EndPoint = "http://127.0.0.1:8188",
            });

             name = "Stable Diffusion WebUI";
            ImageAiServices.Add(name, new ImageAi
            {
                Name = name,
                EndPoint = "http://127.0.0.1:7860",
            });
        }

        public void Load()
        {
        }
    }
}
