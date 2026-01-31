using DesktopAiMascot.aiservice.chat;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DesktopAiMascot.aiservice
{
    public class LlmManager
    {
        public LlmManager()
        {
        }


        public static DataTable GetAvailableLlmServices { get; private set; } = new DataTable()
        {
            Columns =
            {
                new DataColumn("Name", typeof(string))
            },
            Rows =
            {
                { "LM Studio" },
                { "Foundry Local" },
                { "Gemini (AI Studio)" },
                { "Gemini (Google Cloud)" },
            }
        };

        public static ChatAiService? CreateService(string serviceName)
        {
            if (serviceName == "Foundry Local")
            {
                return new FoundryLocalChatService(SystemConfig.Instance.ModelName);
            }
            else if (serviceName == "LM Studio")
            {
                return new LmStudioChatService();
            }
            else if (serviceName == "Gemini (AI Studio)" || serviceName == "Google AI Studio")
            {
                return new GoogleAiStudioChatService();
            }
            else if (serviceName == "Gemini (Google Cloud)")
            {
                return new GoogleCloudChatService();
            }
            return null;
        }
    }
}
