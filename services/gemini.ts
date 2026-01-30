
import { GoogleGenAI, Type } from "@google/genai";
import { Scene, GeneratedSceneResponse, ScriptAnalysis } from "../types";

// Helper to get a fresh instance with the currently selected key
const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * Compresses and resizes an image to avoid API payload limits.
 */
const compressImage = async (dataUrl: string, maxWidth = 1024, quality = 0.8): Promise<{ data: string; mimeType: string }> => {
  if (!dataUrl) return { data: '', mimeType: '' };
  
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxWidth || height > maxWidth) {
        const ratio = Math.min(maxWidth / width, maxWidth / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const newDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve({ data: newDataUrl.split(',')[1], mimeType: 'image/jpeg' });
      } else {
          resolve({ data: dataUrl.split(',')[1] || dataUrl, mimeType: dataUrl.includes('image/png') ? 'image/png' : 'image/jpeg' });
      }
    };
    img.onerror = () => {
       resolve({ data: dataUrl.split(',')[1] || dataUrl, mimeType: dataUrl.includes('image/png') ? 'image/png' : 'image/jpeg' });
    }
    img.src = dataUrl;
  });
};

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      const isRetryable = e.code === 503 || e.status === 'UNAVAILABLE' || e.code === 500 || e.status === 'INTERNAL' || e.code === 429 || e.status === 'RESOURCE_EXHAUSTED';
      if (isRetryable && i < maxRetries - 1) {
        const delay = (e.code === 429 ? 5000 : baseDelay) * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

/**
 * Generates an image generation prompt for the "First Frame" of a script segment.
 */
export const generateFirstFramePrompt = async (
  segment: string, 
  style: string, 
  era: string,
  ethnicity: string, 
  aspectRatio: string,
  referenceImage?: string
): Promise<string> => {
  const ai = getAIClient();
  const textPrompt = `你是一名资深概念设计师。
任务：根据这段剧本片段的“开头情节”，编写一段详细的静止图像生成提示词（中文）。
剧本片段：${segment}
视觉风格：${style}
时代/题材：${era}
角色人种：${ethnicity}
${referenceImage ? '请参考用户提供的参考图进行构图和人设。' : ''}

要求：
1. 构图描述：准确捕捉情节开始的那一瞬间。
2. 细节描述：包含光影、色调、角色神态。
3. **关键：提示词中必须明确包含“${style}”风格、“${era}”时代背景描述和“${ethnicity}”人物特征描述。**
   - 如果是古风，请强调服饰、发型、建筑的古代特征。
   - 如果是现代，请强调现代服饰和环境。
4. 提示词应适合 AI 绘画模型使用。
5. 只输出提示词文本（中文），不要解释。`;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: textPrompt,
    });
    return response.text?.trim() || `一个展现${segment}开头场景的高清电影画面，${style}风格，${era}背景，${ethnicity}人物`;
  });
};

/**
 * Generates an image using gemini-2.5-flash-image.
 */
export const generateImageFromPrompt = async (
  prompt: string, 
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '16:9'
): Promise<string> => {
  const ai = getAIClient();
  
  // Use prompt directly (assuming Chinese as requested)
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("API 未返回图像数据");
  });
};

/**
 * Refines a visual prompt based on user instructions using AI.
 */
export const refinePromptWithAI = async (
  originalPrompt: string, 
  instruction: string, 
  type: 'video' | 'image' = 'video',
  context?: { style: string; era: string; ethnicity: string; aspectRatio: string }
): Promise<string> => {
  const ai = getAIClient();
  
  let typeInstruction = "";
  
  if (type === 'video') {
    typeInstruction = "目标是生成视频：重点描述动态、连贯的剧情发展，画面要有流动性。";
  } else {
    // Enhanced instruction for First Frame / Image
    typeInstruction = `
      目标是生成首帧静态图：
      1. **仅描述起始瞬间的静态构图**，绝对不要包含“随后”、“接着”、“然后”等表示时间流逝或连续动作的词语。
      2. 这是一个单张静态图片，不是视频。
      3. **必须强制融入以下画面设定**（如果提示词中已存在则优化，不存在则必须添加）：
         - 画面比例：${context?.aspectRatio || '默认'}
         - 视觉风格：${context?.style || '默认'}
         - 时代/题材：${context?.era || '默认'}
         - 角色人种：${context?.ethnicity || '默认'}
    `;
  }

  const textPrompt = `你是一名视觉提示词专家。
根据用户的指令修改现有的视觉提示词。
原始提示词：${originalPrompt}
用户指令：${instruction}
修改目标类型：${typeInstruction}

要求：
1. 保持原有提示词的优点。
2. 准确执行用户的修改或补充建议。
3. **确保描述符合设定时代“${context?.era}”的特征**（例如服饰、环境、道具）。
4. 输出结果应依然是中文，且适合作为 AI 生成模型的视觉描述。
5. 只输出修改后的提示词，不要有任何多余的解释。`;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: textPrompt,
    });
    return response.text?.trim() || originalPrompt;
  });
};

export const analyzeScriptDeeply = async (script: string): Promise<ScriptAnalysis> => {
  const ai = getAIClient();
  const textPrompt = `分析提供的短剧剧本。提供：1. 节奏建议 2. 氛围分析 3. 角色弧光 4. 建议切分点。全部内容必须使用中文。剧本: "${script}"`;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: textPrompt,
      config: {
        thinkingConfig: { thinkingBudget: 1024 }, // Enable thinking for better analysis
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pacing_suggestion: { type: Type.STRING },
            tone_analysis: { type: Type.STRING },
            character_arcs: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, arc: { type: Type.STRING } }, required: ["name", "arc"] } },
            suggested_breaks: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { segment: { type: Type.STRING }, reasoning: { type: Type.STRING } }, required: ["segment", "reasoning"] } }
          },
          required: ["pacing_suggestion", "tone_analysis", "character_arcs", "suggested_breaks"]
        },
      },
    });
    return JSON.parse(response.text || "{}") as ScriptAnalysis;
  });
};

/**
 * Intelligent Script Splitting with Duration Constraints.
 */
export const splitScriptSmartly = async (script: string, shotDuration: number): Promise<string[]> => {
  const ai = getAIClient();
  // Calculate max segments based on 24s total limit
  const maxSegments = Math.floor(24 / shotDuration);
  
  const textPrompt = `
    你是一名短剧剪辑导演。
    请将以下剧本切分为 ${maxSegments} 个独立的镜头片段。
    
    参数设置：
    - 预设每个镜头时长：${shotDuration}秒
    - 目标片段数量：${maxSegments} (请尽量切分出 ${maxSegments} 个片段，除非剧本字数少于 20 字)
    
    严格要求：
    1. 必须将剧本内容分散到不同的片段中。
    2. 严禁将所有文字都堆在第一个片段里！
    3. 根据剧情动作、对话或场景变化进行自然切分。
    4. 保持原文内容。
    
    剧本内容：
    "${script}"
  `;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: textPrompt,
      config: {
        thinkingConfig: { thinkingBudget: 2048 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
             segments: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        },
      },
    });

    const jsonText = response.text || "{}";
    try {
      const parsed = JSON.parse(jsonText) as { segments: string[] };
      let segments = parsed.segments || [];
      if (!Array.isArray(segments) || segments.length === 0) return [script];
      return segments.slice(0, maxSegments);
    } catch (e) {
      return [script];
    }
  });
};

/**
 * Generates visual prompts for continuous segments with duration awareness.
 */
export const generatePromptsForContinuousSegments = async (
  segments: string[], 
  style: string, 
  era: string,
  ethnicity: string, 
  aspectRatio: string,
  shotDuration: number,
  referenceImage?: string,
  analysis?: ScriptAnalysis | null
): Promise<GeneratedSceneResponse[]> => {
  const ai = getAIClient();

  // Fix: Define characterProfile to prevent ReferenceError
  const characterProfile = analysis?.character_arcs 
    ? analysis.character_arcs.map(c => c.name).join('、') 
    : "主要角色";

  const textPrompt = `
  你是一名顶级短剧分镜导演，擅长将剧本转化为精确的视觉指令。
  任务：为这 ${segments.length} 个连续的剧本片段编写视觉提示词。

  片段列表：${JSON.stringify(segments)}

  核心参数：
  - 视觉风格：${style}
  - 时代：${era}
  - 人物设定：${ethnicity} (角色：${characterProfile})
  - 画面：${aspectRatio}

  【重要策略：时间切片】
  对于每个片段，你必须在思维链中严格执行以下两步：
  1. **提取 T=0 动作**：找出该片段第一句话、第一个动作或第一个状态。忽略后续发生的所有剧情。
  2. **提取全流程**：概括该片段内发生的所有连贯动作。

  【输出要求】
  对于每个片段，输出两个提示词：

  1. **image_prompt (仅用于生成首帧)**：
    - **核心逻辑**：基于“T=0 动作”编写。
    - **绝对禁语**：严禁出现“然后”、“接着”、“过程”、“一系列”等词。
    - 必须以“${style}风格，${era}背景”开头。
    - 强制包含对角色“${characterProfile}”的静态状态描述，以及“${ethnicity}”特征。
    - **强制结构**：[环境/光影] + [人物T=0时的静态姿势/表情] + [镜头角度]。
    - **示例**：如果是“他推门进入，看见里面坐着人”，首帧描述应为“特写镜头，一只手推开木门的瞬间，门缝透出光线”，或者“背影镜头，他站在门口刚迈出一步”。不要描述“看见里面坐着人”。

  2. **visual_prompt (用于生成视频)**：
    - **核心逻辑**：基于“全流程”编写。
    - **描述方式**：使用流动的语言描述从 A 状态到 B 状态的变化。

  输出格式：JSON 数组，包含 'script_segment', 'visual_prompt', 'image_prompt'。
  `;

  const contents: any[] = [];
  if (referenceImage) {
      const { data, mimeType } = await compressImage(referenceImage);
      contents.push({ inlineData: { mimeType, data } });
  }
  contents.push({ text: textPrompt });

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        thinkingConfig: { thinkingBudget: 2048 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              script_segment: { type: Type.STRING },
              visual_prompt: { type: Type.STRING },
              image_prompt: { type: Type.STRING },
            },
            required: ["script_segment", "visual_prompt", "image_prompt"],
          },
        },
      },
    });

    const jsonText = response.text || "[]";
    try {
      const results = JSON.parse(jsonText) as GeneratedSceneResponse[];
      return segments.map((seg, index) => ({
          script_segment: seg,
          visual_prompt: results[index]?.visual_prompt || "生成失败",
          image_prompt: results[index]?.image_prompt || "生成失败"
      }));
    } catch (e) {
      throw new Error("生成提示词失败");
    }
  });
};

export const generateScenesFromScript = async (script: string, style: string, era: string, ethnicity: string, referenceImage?: string, analysis?: ScriptAnalysis | null): Promise<GeneratedSceneResponse[]> => {
  const ai = getAIClient();
  const textPrompt = `你是短剧分镜师。将剧本拆分为多个分镜。
  
  核心参数：
  - 风格：${style}
  - 时代/题材：${era}
  - 人物：${ethnicity}

  对于每个分镜，提供（**请务必使用中文撰写**）：
  1. 视频提示词 (visual_prompt)：完整、自然地描述剧情流程。
     * 必须在描述中显式包含风格（${style}）、时代特征（${era}）和人种（${ethnicity}）的关键词。
  2. 首帧提示词 (image_prompt)：描述分镜开始时的静态画面。
     * 必须在描述中显式包含风格、时代和人种的关键词。
  
  剧本："${script}"`;
  
  const contents: any[] = [];
  if (referenceImage) {
      const { data, mimeType } = await compressImage(referenceImage);
      contents.push({ inlineData: { mimeType, data } });
  }
  contents.push({ text: textPrompt });

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        thinkingConfig: { thinkingBudget: 2048 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { 
              type: Type.OBJECT, 
              properties: { 
                  script_segment: { type: Type.STRING }, 
                  visual_prompt: { type: Type.STRING },
                  image_prompt: { type: Type.STRING }
              }, 
              required: ["script_segment", "visual_prompt", "image_prompt"] 
          }
        },
      },
    });
    return JSON.parse(response.text || "[]") as GeneratedSceneResponse[];
  });
};

export const generateVideoForScene = async (
  prompt: string, 
  firstFrameImage?: string, 
  aspectRatio: '16:9' | '9:16' = '16:9',
  context?: { style?: string; era?: string }
): Promise<string> => {
  const ai = getAIClient();
  // Use prompt directly (assuming Chinese as requested)
  let workingPrompt = prompt;

  if (context) {
     const contextParts = [];
     if (context.era && !context.era.includes('默认')) contextParts.push(`时代背景：${context.era}`);
     if (context.style && !context.style.includes('默认')) contextParts.push(`视觉风格：${context.style}`);
     
     if (contextParts.length > 0) {
        workingPrompt = `${contextParts.join('，')}。${workingPrompt}`;
     }
  }

  let compressedImage: { data: string, mimeType: string } | null = null;
  if (firstFrameImage) compressedImage = await compressImage(firstFrameImage);

  const request: any = {
    model: 'veo-3.1-fast-generate-preview',
    prompt: workingPrompt,
    config: { numberOfVideos: 1, resolution: '720p', aspectRatio }
  };
  if (compressedImage) request.image = { imageBytes: compressedImage.data, mimeType: compressedImage.mimeType };

  let operation = await ai.models.generateVideos(request);
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 8000));
    operation = await ai.operations.getVideosOperation({ operation });
  }
  // ... 前面代码保持不变
  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

  if (!downloadLink) {
      console.error("视频生成结果为空，请检查模型权限或内容安全过滤。");
      throw new Error("API 未返回视频链接");
  }

  // 直接 fetch 原始 URI，不要拼接 API_KEY
  const videoResponse = await fetch(downloadLink);
  if (!videoResponse.ok) throw new Error(`视频下载失败: ${videoResponse.statusText}`);

  const blob = await videoResponse.blob();
  return URL.createObjectURL(blob);
};
