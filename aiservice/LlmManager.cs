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
    }
}
