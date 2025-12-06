
import { GoogleGenAI } from "@google/genai";
import { GenerationModel, Settings, Character } from "../types";

// Helper: Sleep delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Format error messages
const formatError = (error: any, context: string): string => {
  let msg = error instanceof Error ? error.message : String(error);
  
  // Clean up common error prefixes
  msg = msg.replace(/\[.*?\]\s*/, '');

  if (msg.includes('400') || msg.includes('INVALID_ARGUMENT')) {
      msg = '请求参数错误 (400) - 请检查 API Key 是否正确，或代理地址是否支持该模型。';
  }
  else if (msg.includes('401')) msg = '未授权 (401) - API Key 无效或已过期';
  else if (msg.includes('403')) msg = '拒绝访问 (403) - 权限不足或地区限制';
  else if (msg.includes('404')) msg = '未找到 (404) - 代理地址路径错误或模型不存在 (检查是否多填了 /v1beta)';
  else if (msg.includes('429')) msg = '请求过频 (429) - 额度耗尽，正在重试...';
  else if (msg.includes('500')) msg = '服务器错误 (500)';
  else if (msg.includes('503')) msg = '服务不可用 (503)';
  else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) msg = '网络连接失败 - 请检查 VPN/代理设置或代理地址是否允许跨域(CORS)';
  
  return `${context}: ${msg}`;
};

/**
 * Execute an API operation with Automatic Key Rotation
 */
const executeWithKeyRotation = async <T>(
    settings: Settings, 
    operation: (ai: GoogleGenAI) => Promise<T>,
    contextName: string
): Promise<T> => {
    const keys = settings.apiKeys && settings.apiKeys.length > 0 ? settings.apiKeys : [];
    
    if (keys.length === 0) {
        throw new Error("未配置 API Key，请在设置中添加");
    }

    // Smart BaseURL Handling
    let baseUrl: string | undefined = undefined;
    if (settings.baseUrl && settings.baseUrl.trim()) {
        let url = settings.baseUrl.trim();
        // Remove trailing slashes
        url = url.replace(/\/+$/, '');
        // Remove version suffixes if present (SDK adds them automatically)
        url = url.replace(/\/v1beta$/, '').replace(/\/v1$/, '');
        
        // Only set if it's not the official default (to avoid explicit undefined issues)
        if (url !== 'https://generativelanguage.googleapis.com') {
            baseUrl = url;
        }
    }

    let lastError: any = null;

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i].trim();
        if (!key) continue;

        try {
            // Standard SDK Initialization
            const clientOptions: any = { apiKey: key };
            if (baseUrl) {
                clientOptions.baseUrl = baseUrl;
            }

            console.log(`[GeminiService] Initializing with BaseURL: ${baseUrl || 'OFFICIAL_DEFAULT'}`);
            const ai = new GoogleGenAI(clientOptions);
            
            return await operation(ai);

        } catch (error: any) {
            lastError = error;
            const msg = error.message || String(error);
            
            // Retry on rotation-worthy errors
            const shouldRotate = msg.includes('429') || msg.includes('Quota') || msg.includes('401') || msg.includes('403');

            if (shouldRotate) {
                console.warn(`[GeminiService] Key ending in ...${key.slice(-4)} failed. Rotating... (${msg})`);
                if (i === keys.length - 1) break;
                await sleep(1000); // Wait a bit before next key
                continue; 
            } else {
                // For other errors (400, 404, Network), fail immediately as they are likely config issues
                throw error;
            }
        }
    }

    const errorMsg = formatError(lastError, contextName);
    console.error(errorMsg);
    throw new Error(errorMsg);
};

/**
 * Test API Connection
 */
export const testApiConnection = async (apiKey: string, baseUrl: string, model: string = 'gemini-2.5-flash'): Promise<boolean> => {
  const settings: Settings = {
      apiKeys: [apiKey],
      baseUrl: baseUrl,
      textModel: model,
      imageModel: GenerationModel.GEMINI_2_5_FLASH_IMAGE, // Dummy
      jianYingPath: '',
      outputImgPath: '',
      themeColor: ''
  };

  const operation = async (ai: GoogleGenAI) => {
      // Use a standard prompt that is unlikely to be blocked
      await ai.models.generateContent({
        model: model,
        contents: "Hello",
      });
      return true;
  };

  return executeWithKeyRotation(settings, operation, "连接测试");
};

/**
 * Image Generation
 */
export const generateImage = async (
  prompt: string,
  settings: Settings,
  aspectRatio: string,
  characterImageBase64?: string,
  styleImageBase64?: string,
  isHD: boolean = false
): Promise<string> => {
  const model = isHD ? GenerationModel.GEMINI_3_PRO_IMAGE_PREVIEW : settings.imageModel;

  const operation = async (ai: GoogleGenAI) => {
    const parts: any[] = [];
    let systemText = "";

    // 1. Style Reference
    if (styleImageBase64) {
      const base64Data = styleImageBase64.replace(/^data:image\/\w+;base64,/, "");
      parts.push({
        inlineData: { data: base64Data, mimeType: 'image/png' },
      });
      systemText += "【Style Reference】: Copy the art style (lighting, texture, rendering) of the FIRST image. Ignore its content. \n";
    }

    // 2. Character Reference
    if (characterImageBase64) {
      const base64Data = characterImageBase64.replace(/^data:image\/\w+;base64,/, "");
      parts.push({
        inlineData: { data: base64Data, mimeType: 'image/png' },
      });
      systemText += "【Character Reference】: Maintain character consistency with this image. \n";
    }

    // 3. Prompt
    systemText += `【Prompt】: ${prompt}`;
    parts.push({ text: systemText });

    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: parts },
        config: {
            imageConfig: { aspectRatio: aspectRatio },
        },
    });

    // Check outputs
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("API返回结果中未找到图片数据");
  };

  return executeWithKeyRotation(settings, operation, "生图失败");
};

/**
 * Analyze Roles (JSON)
 */
export const analyzeRoles = async (script: string, settings: Settings): Promise<Character[]> => {
  const safeScript = script.substring(0, 30000); // Limit context

  const prompt = `Role extraction. Output JSON array only.
  Format: [{"name": "Name", "description": "Age, Gender, Hair, Clothes..."}]
  Script:
  ${safeScript}`;

  const operation = async (ai: GoogleGenAI) => {
      const response = await ai.models.generateContent({
          model: settings.textModel,
          contents: prompt,
          config: { 
              responseMimeType: 'application/json' 
          }
      });
      
      let text = response.text || "[]";
      // Sanitize markdown code blocks if any
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      return JSON.parse(text);
  };

  return executeWithKeyRotation(settings, operation, "角色分析失败");
};

/**
 * Batch Prompt Inference (JSON)
 */
export const inferBatchPrompts = async (
    scripts: string[],
    allCharacters: Character[],
    settings: Settings,
    prevContextSummary: string
): Promise<{ prompt: string, activeNames: string[] }[]> => {
    
    const libContext = allCharacters.length > 0 
    ? `Characters: ${allCharacters.map(c => `${c.name}(${c.description})`).join('; ')}`
    : "Characters: None";

    const prompt = `Storyboard Prompt Generator.
    ${libContext}
    Rules: 
    1. No names in prompt, use descriptions.
    2. No pronouns (he/she).
    3. Include: appearance, action, expression, shot size, scene, lighting.
    
    Input JSON Format: { "id": index, "script": "text" }
    Output JSON Format: Array of { "prompt": "visual description", "activeCharacterNames": ["name"] }
    
    Scripts:
    ${JSON.stringify(scripts.map((s, i) => ({ id: i, script: s })))}
    `;

    const operation = async (ai: GoogleGenAI) => {
        const response = await ai.models.generateContent({
            model: settings.textModel,
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        
        let text = response.text || "[]";
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(text);
        
        // Normalize output
        if (Array.isArray(json)) {
            return json.map((item: any) => ({
                prompt: item.prompt || "",
                activeNames: item.activeCharacterNames || item.activeNames || []
            }));
        }
        return Array(scripts.length).fill({ prompt: "", activeNames: [] });
    };

    return executeWithKeyRotation(settings, operation, "批量推理失败");
};

/**
 * Single Frame Inference
 */
export const inferFrameData = async (
  currentScript: string,
  allCharacters: Character[],
  settings: Settings,
  contextBefore: string[] = [], 
  contextAfter: string[] = []
): Promise<{ prompt: string, activeNames: string[] }> => {
  
  const prompt = `Generate Visual Prompt.
  Script: ${currentScript}
  Characters: ${allCharacters.map(c => c.name).join(', ')}
  Output JSON: { "prompt": "desc", "activeCharacterNames": [] }`;

  const operation = async (ai: GoogleGenAI) => {
      const response = await ai.models.generateContent({
          model: settings.textModel,
          contents: prompt,
          config: { responseMimeType: 'application/json' }
      });
      let text = response.text || "{}";
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const json = JSON.parse(text);
      return {
          prompt: json.prompt || "", 
          activeNames: json.activeCharacterNames || []
      };
  };

  return executeWithKeyRotation(settings, operation, "推理失败");
};

/**
 * Breakdown Script
 */
export const breakdownScript = async (scriptText: string, settings: Settings): Promise<string[]> => {
  const prompt = `Split script into shots. Output JSON string array.
  Script: ${scriptText}`;

  const operation = async (ai: GoogleGenAI) => {
      const response = await ai.models.generateContent({
          model: settings.textModel,
          contents: prompt,
          config: { responseMimeType: 'application/json' }
      });
      let text = response.text || "[]";
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(text);
  };

  return executeWithKeyRotation(settings, operation, "分镜拆解失败");
};
