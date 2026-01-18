using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DesktopAiMascot.aiservice
{
    class MovieAi
    {
        public string Name { get; set; } = string.Empty;
        public string EndPoint { get; set; } = string.Empty;
        public string ApiKey { get; set; } = string.Empty;

    }

    internal class MovieAiManager
    {
        private static MovieAiManager? instance = null;
        public Dictionary<string, MovieAi> MovieAiServices { get; private set; } = new Dictionary<string, MovieAi>();
        public MovieAi? CurrentService { get; set; } = null;
        public static MovieAiManager Instance
        {
            get
            {
                if (instance == null)
                {
                    instance = new MovieAiManager();
                }
                return instance;
            }
        }

        MovieAiManager()
        {
            string name = String.Empty;

            name = "ComfyUI";
            MovieAiServices.Add(name, new MovieAi
            {
                Name = name,
                EndPoint = "http://127.0.0.1:8188",
            });
        }

        public void Load()
        {
        }
    }
}
