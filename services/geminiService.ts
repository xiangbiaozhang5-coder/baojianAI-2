
import { GoogleGenAI } from "@google/genai";
import { GenerationModel, Settings, Character } from "../types";

// --- Helpers ---

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Clean Base URL
const cleanBaseUrl = (url?: string): string | undefined => {
    if (!url || !url.trim()) return undefined; 
    let cleaned = url.trim();
    cleaned = cleaned.replace(/\/+$/, '');
    if (cleaned.endsWith('/v1beta')) cleaned = cleaned.substring(0, cleaned.length - 7);
    if (cleaned.endsWith('/v1')) cleaned = cleaned.substring(0, cleaned.length - 3);
    cleaned = cleaned.replace(/\/+$/, '');
    
    if (cleaned === 'https://generativelanguage.googleapis.com') return undefined;
    return cleaned;
};

const cleanApiKey = (key: string): string => {
    if (!key) return "";
    return key.replace(/[\s\uFEFF\xA0]+/g, '').replace(/^Bearer\s+/i, '');
};

const extractJSON = (text: string): any => {
    try {
        return JSON.parse(text);
    } catch (e) {
        const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
            try { return JSON.parse(match[1]); } catch (e2) {}
        }
        const firstOpen = text.search(/[\{\[]/);
        const lastClose = text.search(/[\}\]]$/);
        if (firstOpen !== -1) {
             const sub = text.substring(firstOpen);
             const lastBrace = sub.lastIndexOf('}');
             const lastBracket = sub.lastIndexOf(']');
             const end = Math.max(lastBrace, lastBracket);
             if (end !== -1) {
                 try { return JSON.parse(sub.substring(0, end + 1)); } catch (e3) {}
             }
        }
        throw new Error("Invalid JSON response from AI");
    }
};

const formatError = (error: any): string => {
  let msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('400')) return '请求无效 (400) - 请检查 API Key 或模型';
  if (msg.includes('401')) return '鉴权失败 (401) - API Key 无效';
  if (msg.includes('403')) return '拒绝访问 (403) - 余额不足或无权限';
  if (msg.includes('404')) return '地址错误 (404) - 接口地址配置错误';
  if (msg.includes('429')) return '请求过频 (429) - 请稍后重试';
  if (msg.includes('AbortError') || msg.includes('aborted')) return '操作已取消';
  if (msg.includes('Failed to fetch')) return '网络连接失败';
  return msg;
};

// --- Core Execution ---

const executeRequest = async <T>(
    settings: Settings, 
    operation: (ai: GoogleGenAI) => Promise<T>,
    retries = 1
): Promise<T> => {
    const apiKey = cleanApiKey(settings.apiKey);
    const baseUrl = cleanBaseUrl(settings.baseUrl);

    if (!apiKey) throw new Error("未配置 API Key");

    const clientOptions: any = { apiKey };
    if (baseUrl) clientOptions.baseUrl = baseUrl;

    const ai = new GoogleGenAI(clientOptions);

    let lastError;
    for (let i = 0; i <= retries; i++) {
        try {
            return await operation(ai);
        } catch (error: any) {
            lastError = error;
            const msg = error.message || "";
            // Don't retry if aborted
            if (msg.includes('AbortError') || msg.includes('aborted')) {
                throw error;
            }
            if (msg.includes('429') || msg.includes('503')) {
                if (i < retries) {
                    await sleep(2000 * (i + 1));
                    continue;
                }
            }
            break; 
        }
    }
    throw new Error(formatError(lastError));
};

// --- Services ---

export const testApiConnection = async (apiKey: string, baseUrl: string, model: string): Promise<boolean> => {
    const settings = { apiKey, baseUrl, textModel: model } as Settings;
    return executeRequest(settings, async (ai) => {
        await ai.models.generateContent({
            model: model,
            contents: { parts: [{ text: 'Ping' }] }
        });
        return true;
    }, 0);
};

export const generateImage = async (
  prompt: string,
  settings: Settings,
  aspectRatio: string,
  characterImageBase64?: string,
  styleImageBase64?: string,
  isHD: boolean = false,
  signal?: AbortSignal
): Promise<string> => {
  const model = isHD ? GenerationModel.GEMINI_3_PRO_IMAGE_PREVIEW : settings.imageModel;

  return executeRequest(settings, async (ai) => {
    // Check abort before start
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const parts: any[] = [];
    let systemText = "";

    if (styleImageBase64) {
      parts.push({ inlineData: { data: styleImageBase64.replace(/^data:image\/\w+;base64,/, ""), mimeType: 'image/png' } });
      systemText += "【Style Reference】: Copy the art style (lighting, texture) of the FIRST image. Ignore its content.\n";
    }
    if (characterImageBase64) {
      parts.push({ inlineData: { data: characterImageBase64.replace(/^data:image\/\w+;base64,/, ""), mimeType: 'image/png' } });
      systemText += "【Character Reference】: Maintain character consistency with this image.\n";
    }

    systemText += `【Description】: ${prompt}`;
    parts.push({ text: systemText });

    const response = await ai.models.generateContent({
        model: model,
        contents: { parts },
        config: { imageConfig: { aspectRatio } },
    });
    
    // Check abort after response (before processing)
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("生图失败：API 未返回图片数据");
  });
};

export const inferBatchPrompts = async (
    scripts: string[],
    allCharacters: Character[],
    settings: Settings,
    prevContextSummary: string
): Promise<{ prompt: string, activeNames: string[] }[]> => {
    
    await sleep(300);

    const libContext = allCharacters.length > 0 
    ? `【可用角色库】:\n${allCharacters.map(c => `- ${c.name} (外貌: ${c.description})`).join('\n')}`
    : "";

    const prompt = `你是一个AI分镜师。根据剧本生成画面描述。
    
    ${libContext}

    规则：
    1. **去名化**：描述词中禁止出现“李明”等名字，用外貌描述代替。
    2. **去代词**：禁止使用“他/她”。
    3. **格式**：[角色描述]，[动作]，[景别]，[环境]。
    4. **上文参考**：${prevContextSummary}

    任务：为以下 ${scripts.length} 个剧本片段生成描述。
    ${scripts.map((s, i) => `片段${i}: ${s}`).join('\n')}

    输出格式：
    纯 JSON 数组：
    [{"prompt": "描述...", "activeNames": ["角色名"]}]
    `;

    try {
        return await executeRequest(settings, async (ai) => {
            const res = await ai.models.generateContent({
                model: settings.textModel,
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            const text = res.text || "[]";
            const json = extractJSON(text);
            if (Array.isArray(json)) {
                return json.map((item: any) => ({
                    prompt: item.prompt || "",
                    activeNames: item.activeNames || item.activeCharacterNames || []
                }));
            }
            return Array(scripts.length).fill({ prompt: "", activeNames: [] });
        });
    } catch (e) {
        console.error(e);
        return Array(scripts.length).fill({ prompt: "", activeNames: [] });
    }
};

export const inferFrameData = async (
  currentScript: string,
  allCharacters: Character[],
  settings: Settings,
  contextBefore: string[] = [], 
  contextAfter: string[] = []
): Promise<{ prompt: string, activeNames: string[] }> => {
  const libContext = allCharacters.length > 0 
    ? `【角色库】:${allCharacters.map(c => `${c.name}(${c.description})`).join(';')}`
    : "";

  const prompt = `分镜画面生成。
  ${libContext}
  前文：${contextBefore.join(';')}
  当前：${currentScript}
  后文：${contextAfter.join(';')}
  
  要求：
  1. 结合前文保持连贯。
  2. 禁用人名和代词，用外貌描述。
  3. 包含景别 (Shot Size)。

  返回 JSON: {"prompt": "...", "activeNames": []}
  `;

  try {
      return await executeRequest(settings, async (ai) => {
          const res = await ai.models.generateContent({
              model: settings.textModel,
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });
          const json = extractJSON(res.text || "{}");
          return {
              prompt: json.prompt || "", 
              activeNames: json.activeNames || json.activeCharacterNames || []
          };
      });
  } catch (e) {
      console.error(e);
      return { prompt: "", activeNames: [] };
  }
};

export const analyzeRoles = async (script: string, settings: Settings): Promise<Character[]> => {
  const prompt = `提取剧本角色。
  要求：
  1. description 格式："[年龄][性别]，[发型]，身穿[衣着]"。
  2. 输出 JSON 数组：[{"name": "...", "description": "..."}]
  
  剧本：${script.substring(0, 30000)}`;

  try {
      return await executeRequest(settings, async (ai) => {
          const res = await ai.models.generateContent({
              model: settings.textModel,
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });
          const json = extractJSON(res.text || "[]");
          return Array.isArray(json) ? json.map((c: any) => ({
             id: '', name: c.name || "Unknown", description: c.description || ""
          })) : [];
      });
  } catch (e) {
      console.error(e);
      return [];
  }
};

export const breakdownScript = async (scriptText: string, settings: Settings): Promise<string[]> => {
  const prompt = `拆分剧本为分镜列表。保留原文。输出 JSON 字符串数组。
  文本：${scriptText.substring(0, 30000)}`;

  try {
      return await executeRequest(settings, async (ai) => {
          const res = await ai.models.generateContent({
              model: settings.textModel,
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });
          return extractJSON(res.text || "[]");
      });
  } catch (e) {
      return scriptText.split('\n').filter(l => l.trim());
  }
};
