using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

///
/// ComfyのWorkflowを修正するクラス
///

namespace DesktopAiMascot.aiservice.image
{
    internal class ComfyWorkflow
    {
        private string WorkflowPath = "";
        private Dictionary<string, JsonElement> WorkflowData = new Dictionary<string, JsonElement>();
        
        private static readonly JsonSerializerOptions SerializerOptions = new JsonSerializerOptions
        {
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };

        private ComfyWorkflow(string workflowPath, Dictionary<string, JsonElement> workflowData)
        {
            WorkflowPath = workflowPath;
            WorkflowData = workflowData;
        }

        public Dictionary<string, JsonElement> GetWorkflow() { return this.WorkflowData; }

        /**
         * Comfyに送信するための HTTP Post Payload を作成する
         */
        public StringContent GetHttpPostContent( string clientId )
        {
            var payload = new
            {
                client_id = clientId,
                prompt = this.WorkflowData
            };

            var json = JsonSerializer.Serialize(payload, SerializerOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            return content;
        }

        public static async Task<ComfyWorkflow> Load(string workflowPath)
        {
            // ワークフローファイルを読み込む
            var workflowJson = await File.ReadAllTextAsync(workflowPath);

            // JSONをパースする
            var workflow = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(workflowJson);
            if(workflow == null)
            {
                throw new Exception("Failed to parse workflow JSON.");
            }

            return new ComfyWorkflow(workflowPath, workflow);
        }

        /// <summary>
        /// ノードの内容をログに出力する
        /// </summary>
        /// <param name="nodeId">ノードID</param>
        public void LogNodeContent(string nodeId)
        {
            if (!WorkflowData.ContainsKey(nodeId))
            {
                Debug.WriteLine($"[ComfyWorkflow] Node ID '{nodeId}' not found in workflow.");
                return;
            }

            var nodeElement = WorkflowData[nodeId];
            var logOptions = new JsonSerializerOptions 
            { 
                WriteIndented = true,
                Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
            };
            var formattedJson = JsonSerializer.Serialize(nodeElement, logOptions);
            
            Debug.WriteLine($"[ComfyWorkflow] Node '{nodeId}' content:");
            Debug.WriteLine(formattedJson);
        }

        /**
         * 入力画像ノードにアップロード画像を設定する
         * @param nodeId 画像ローダーのノードID
         * @param uploadedFileName アップロードされた画像ファイル名
         * ＊先にアップロード画像をComfyUIのアップロードフォルダに保存しておくこと
         */
        public void SetImageInput(string nodeId, string uploadedFileName)
        {
            if (!WorkflowData.ContainsKey(nodeId))
            {
                throw new ArgumentException($"Node ID '{nodeId}' not found in workflow.");
            }

            Debug.WriteLine($"[ComfyWorkflow] SetImageInput - Node '{nodeId}' before:");
            LogNodeContent(nodeId);

            var targetElement = WorkflowData[nodeId];
            
            // JsonElement を JsonNode に変換して編集可能にする
            var targetNode = JsonNode.Parse(targetElement.GetRawText());
            
            if (targetNode == null)
            {
                throw new Exception($"Failed to parse node '{nodeId}'.");
            }

            // inputs プロパティを取得または作成
            if (targetNode["inputs"] == null)
            {
                targetNode["inputs"] = new JsonObject();
            }

            // image プロパティを設定
            targetNode["inputs"]!["image"] = uploadedFileName;

            // JsonElement に戻して WorkflowData を更新
            var updatedElement = JsonSerializer.Deserialize<JsonElement>(targetNode.ToJsonString(), SerializerOptions);
            WorkflowData[nodeId] = updatedElement;

            Debug.WriteLine($"[ComfyWorkflow] SetImageInput - Node '{nodeId}' after:");
            LogNodeContent(nodeId);
        }

        /**
         * 画像のプロンプトを設定する
         * @param nodeId プロンプトの入力ノードID
         * @param userPrompt 画像生成用のプロンプト文
         */
        public void SetTextPrompt(string nodeId, string userPrompt)
        {
            if (!WorkflowData.ContainsKey(nodeId))
            {
                throw new ArgumentException($"Node ID '{nodeId}' not found in workflow.");
            }

            Debug.WriteLine($"[ComfyWorkflow] SetTextPrompt - Node '{nodeId}' before:");
            LogNodeContent(nodeId);

            var targetElement = WorkflowData[nodeId];
            
            // JsonElement を JsonNode に変換して編集可能にする
            var targetNode = JsonNode.Parse(targetElement.GetRawText());
            
            if (targetNode == null)
            {
                throw new Exception($"Failed to parse node '{nodeId}'.");
            }

            // inputs プロパティを取得または作成
            if (targetNode["inputs"] == null)
            {
                targetNode["inputs"] = new JsonObject();
            }

            // prompt プロパティを設定
            targetNode["inputs"]!["prompt"] = userPrompt;

            // JsonElement に戻して WorkflowData を更新
            var updatedElement = JsonSerializer.Deserialize<JsonElement>(targetNode.ToJsonString(), SerializerOptions);
            WorkflowData[nodeId] = updatedElement;

            Debug.WriteLine($"[ComfyWorkflow] SetTextPrompt - Node '{nodeId}' after:");
            LogNodeContent(nodeId);
        }

        public void SetSeed(int seed)
        {
            var nodeId = FindNodeByClassName("KSampler");
            if (nodeId == null)
            {
                throw new Exception("KSampler node not found in workflow.");
            }

            Debug.WriteLine($"[ComfyWorkflow] SetSeed - Node '{nodeId}' before:");
            LogNodeContent(nodeId);

            var targetElement = WorkflowData[nodeId];
            
            // JsonElement を JsonNode に変換して編集可能にする
            var targetNode = JsonNode.Parse(targetElement.GetRawText());
            
            if (targetNode == null)
            {
                throw new Exception($"Failed to parse node '{nodeId}'.");
            }

            // inputs プロパティを取得または作成
            if (targetNode["inputs"] == null)
            {
                targetNode["inputs"] = new JsonObject();
            }

            // seed プロパティを設定
            targetNode["inputs"]!["seed"] = seed;

            // JsonElement に戻して WorkflowData を更新
            var updatedElement = JsonSerializer.Deserialize<JsonElement>(targetNode.ToJsonString(), SerializerOptions);
            WorkflowData[nodeId] = updatedElement;

            Debug.WriteLine($"[ComfyWorkflow] SetSeed - Node '{nodeId}' after:");
            LogNodeContent(nodeId);
        }

        /// <summary>
        /// クラス名でノードを検索する
        /// </summary>
        /// <param name="className">検索するクラス名</param>
        /// <returns>見つかったノードID、見つからない場合は null</returns>
        public string? FindNodeByClassName(string className)
        {
            foreach (var kvp in WorkflowData)
            {
                var nodeId = kvp.Key;
                var nodeElement = kvp.Value;

                if (nodeElement.TryGetProperty("class_type", out var classTypeElement))
                {
                    var classType = classTypeElement.GetString();
                    if (classType == className)
                    {
                        return nodeId;
                    }
                }
            }

            return null;
        }
    }
}
