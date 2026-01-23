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
                { "Open AI (未実装)" },
                { "Chat GPT (未実装)" },
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
            return null;
        }
    }
}
