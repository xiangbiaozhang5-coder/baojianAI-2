import { GoogleGenAI } from "@google/genai";
import { GenerationModel, Settings, Character } from "../types";

// Helper to format error messages
const formatError = (error: any, context: string): string => {
  let msg = error instanceof Error ? error.message : String(error);
  
  // Common SDK/Fetch errors translation
  if (msg.includes('401')) msg = 'API Key 无效或未授权 (401)';
  else if (msg.includes('403')) msg = 'API Key 权限不足或被拒绝 (403)';
  else if (msg.includes('404')) msg = '请求的资源/模型不存在 (404) - 请检查代理地址或模型名称';
  else if (msg.includes('429')) msg = '请求过于频繁 (429) - 请稍后重试';
  else if (msg.includes('500')) msg = 'AI 服务内部错误 (500)';
  else if (msg.includes('503')) msg = '服务暂时不可用 (503)';
  else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) msg = '网络连接失败 - 请检查网络或代理地址连通性 (CORS/HTTPS)';
  
  return `${context}: ${msg}`;
};

// Helper to create client with dynamic settings
const getClient = (settings: Settings) => {
  // Priority: 
  // 1. Settings from UI 
  // 2. Vite Env Var (VITE_API_KEY)
  // 3. Fallback (empty string)
  const apiKey = settings.apiKey || (import.meta as any).env?.VITE_API_KEY || '';
  
  const options: any = {
      apiKey: apiKey
  };

  // Only pass baseUrl if configured and not empty
  if (settings.baseUrl && settings.baseUrl.trim() !== '') {
      let url = settings.baseUrl.trim();
      // Remove trailing slash to avoid double slash issues in SDK
      if (url.endsWith('/')) {
          url = url.slice(0, -1);
      }
      options.baseUrl = url;
  }
  
  return new GoogleGenAI(options);
};

/**
 * Image Generation
 */
export const generateImage = async (
  prompt: string,
  settings: Settings,
  aspectRatio: string,
  referenceImageBase64?: string,
  isHD: boolean = false
): Promise<string> => {
  const ai = getClient(settings);
  const model = isHD ? GenerationModel.NANOBANANA_PRO : settings.imageModel;

  try {
    const parts: any[] = [];
    if (referenceImageBase64) {
      const base64Data = referenceImageBase64.replace(/^data:image\/\w+;base64,/, "");
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: 'image/png',
        },
      });
    }

    // Force style prompts if needed, but usually the prompt itself is enough.
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: parts },
      config: {
        imageConfig: { aspectRatio: aspectRatio },
      },
    });

    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("模型未返回图片数据");
  } catch (error) {
    const errorMsg = formatError(error, "生图失败");
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
};

/**
 * Analyze Script for Roles (Full Text Analysis) - CHINESE
 */
export const analyzeRoles = async (script: string, settings: Settings): Promise<Character[]> => {
  const ai = getClient(settings);
  const prompt = `请分析以下剧本内容，提取所有主要角色。
  
  请严格按照以下格式生成【description】字段：
  "一个[年龄段][性别]，[年龄]，[发型与发色]，[服装描写]"
  
  格式要求：
  1. 年龄段性别：例如 "一个年轻男人"、"一个中年女人"、"一个老年男人"、"一个男孩"、"一个女孩"。
  2. 年龄：例如 "20岁"、"45岁"。
  3. 发型与发色：例如 "黑色短发"、"金色长卷发"。
  4. 服装描写：例如 "白色T恤"、"黑色西装"。
  5. 如果剧本中没有具体描述，请根据剧情合理推理补全，确保描述完整且符合上述格式。
  
  必须使用中文回答。
  输出格式必须为 JSON 数组，不包含 markdown 标记：
  [
    { "name": "角色名", "description": "一个年轻男人，20岁，黑色短发，白色T恤" },
    ...
  ]

  剧本内容：
  ${script}`;

  try {
    const response = await ai.models.generateContent({
      model: settings.textModel,
      contents: prompt,
    });
    
    let text = response.text || "[]";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    const errorMsg = formatError(error, "角色分析失败");
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
};

/**
 * Infer Batch Prompts (Sequence Analysis) - Optimized for 5-10 frames with Shot Sizes
 */
export const inferBatchPrompts = async (
    scripts: string[],
    allCharacters: Character[],
    settings: Settings,
    prevContextSummary: string
): Promise<{ prompt: string, activeNames: string[] }[]> => {
    const ai = getClient(settings);

    const libContext = allCharacters.length > 0 
    ? `【可用角色库（必须严格遵守以下外貌）】：\n${allCharacters.map(c => `- ${c.name}: ${c.description}`).join('\n')}`
    : "【可用角色库】：无";

    const prompt = `你是一个专业的AI电影分镜师。请分析以下一组连续的剧本分镜（共 ${scripts.length} 行），生成相应的画面描述词。

    ${libContext}

    **核心要求**：
    1.  **强制包含景别 (Shot Size)**：
        *   每个分镜的描述词 **必须** 以景别开头。
        *   可选景别：大特写(Extreme Close-up), 特写(Close-up), 中景(Medium Shot), 全景(Wide Shot), 远景(Long Shot), 仰视(Low Angle), 俯视(High Angle), 航拍(Aerial Shot)。
        *   示例："特写 Close-up, 一个年轻男人的脸..." 或 "全景 Wide Shot, 繁华的街道..."

    2.  **组合使用**：
        *   可以组合景别和运镜，例如："仰视特写 Low Angle Close-up"。

    3.  **连贯性与一致性**：
        *   这是一组连续镜头，请确保环境、光影、色调在分镜之间保持连贯。
        *   参考上文情节：${prevContextSummary}

    4.  **角色一致性**：
        *   严格使用角色库中的外貌描述。

    **输出格式**：
    必须是纯 JSON 数组，包含 ${scripts.length} 个对象。
    [
      { "activeCharacterNames": ["角色A"], "prompt": "特写 Close-up, [角色A外貌], [表情动作], [环境光影]" },
      ...
    ]

    **待分析剧本**：
    ${scripts.map((s, i) => `分镜${i+1}: ${s}`).join('\n')}
    `;

    try {
        const response = await ai.models.generateContent({
            model: settings.textModel,
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });

        const text = response.text || "[]";
        const json = JSON.parse(text);
        
        if (Array.isArray(json)) {
            return json;
        }
        return Array(scripts.length).fill({ prompt: "", activeNames: [] });

    } catch (error) {
        console.error("Batch inference failed", error);
        // Fallback return empty to prevent crash
        return Array(scripts.length).fill({ prompt: "", activeNames: [] });
    }
};

/**
 * Infer Single Frame Data (Legacy / Single Mode)
 */
export const inferFrameData = async (
  currentScript: string,
  allCharacters: Character[], // Pass ALL available characters for inference
  settings: Settings,
  contextBefore: string[] = [], 
  contextAfter: string[] = []
): Promise<{ prompt: string, activeNames: string[] }> => {
  const ai = getClient(settings);
  
  // Format character library for the prompt
  // Include explicit instruction to USE exact description
  const libContext = allCharacters.length > 0 
    ? `【可用角色库（必须严格遵守以下外貌）】：\n${allCharacters.map(c => `- ${c.name}: ${c.description}`).join('\n')}`
    : "【可用角色库】：无";

  const prompt = `你是一个专业的AI电影分镜师。请根据当前剧本分镜，结合上下文，推断画面中的角色、动作和环境。

  ${libContext}

  **核心逻辑与规则：**

  1.  **必须包含景别 (Shot Size)**：描述词开头必须指定景别（如：特写 Close-up, 中景 Medium Shot, 全景 Wide Shot, 仰视 Low Angle 等）。
  2.  **场景一致性**：强制继承上文环境。
  3.  **角色一致性**：锁定角色库外貌。

  **JSON 输出**：
  {
    "activeCharacterNames": ["角色A", "角色B"], 
    "prompt": "[景别], [外貌描述], [动作]..."
  }

  【上文参考】：
  ${contextBefore.slice(-5).join('\n')}

  【当前分镜剧本】：
  ${currentScript}
  `;

  try {
    const response = await ai.models.generateContent({
      model: settings.textModel,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });
    
    const text = response.text || "{}";
    const json = JSON.parse(text);
    
    return {
        prompt: json.prompt || "", 
        activeNames: Array.isArray(json.activeCharacterNames) ? json.activeCharacterNames : []
    };
  } catch (error) {
    const errorMsg = formatError(error, "推理失败");
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
};

/**
 * Breakdown Script - SMART AI
 */
export const breakdownScript = async (scriptText: string, settings: Settings): Promise<string[]> => {
  const ai = getClient(settings);
  const prompt = `你是一位专业电影导演。请智能分析以下小说或剧本内容，将其拆分为一系列连贯的、画面感强的分镜脚本。
  
  规则：
  1. 识别剧情的关键转折和动作，合理断句。
  2. 每个分镜应包含一个完整的视觉动作或场景。
  3. 输出纯 JSON 字符串数组格式：["分镜1内容", "分镜2内容"]。
  4. 使用中文。
  
  文本：
  ${scriptText}`;

  try {
    const response = await ai.models.generateContent({
      model: settings.textModel,
      contents: prompt,
    });
    let text = response.text || "[]";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    const errorMsg = formatError(error, "分镜拆解失败");
    console.error(errorMsg);
    // Fallback locally is handled by caller usually, but throwing here lets UI know AI failed.
    // However, for this specific function, fallback to local split is a valid strategy.
    // Let's return local split but log error.
    return scriptText.split('\n').filter(l => l.trim().length > 0);
  }
};