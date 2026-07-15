import { GoogleGenAI } from "@google/genai";
import type OpenAI from "openai";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getOpenAIClient } from "./openai-client";
import { getGeminiClient } from "./gemini-client";
import { getReplitClient } from "./replit-client";

type AIProvider = "openai" | "gemini" | "replit";

let cachedProvider: AIProvider | null = null;
let cachedImageModels: Record<string, string> | null = null;

export async function getActiveProvider(): Promise<AIProvider> {
  if (cachedProvider) {
    return cachedProvider;
  }

  const [setting] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "ai_provider"));

  const provider = (setting?.value ?? "openai") as AIProvider;
  cachedProvider = provider;
  return provider;
}

export async function getImageModel(provider: AIProvider): Promise<string> {
  if (cachedImageModels && cachedImageModels[provider]) {
    return cachedImageModels[provider];
  }

  const [setting] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, `${provider}_image_model`));

  const defaults: Record<AIProvider, string> = {
    openai: "gpt-image-1.5",
    gemini: "gemini-2.5-flash-image",
    replit: "gpt-image-1",
  };

  const model = setting?.value ?? defaults[provider];
  if (!cachedImageModels) cachedImageModels = {};
  cachedImageModels[provider] = model;
  return model;
}

export function clearProviderCache(): void {
  cachedProvider = null;
  cachedImageModels = null;
}

function isGptImageModel(model: string): boolean {
  return model.startsWith("gpt-image") || model.startsWith("chatgpt-image");
}

function isDalleModel(model: string): boolean {
  return model.startsWith("dall-e");
}

type ImageSize = "1024x1024" | "1792x1024" | "1024x1792" | "512x512" | "256x256";

function mapSizeForGptImage(size: ImageSize): "1024x1024" | "1536x1024" | "1024x1536" | "auto" {
  if (size === "1792x1024") return "1536x1024";
  if (size === "1024x1792") return "1024x1536";
  if (size === "1024x1024") return "1024x1024";
  return "auto";
}

export async function getAIClient(): Promise<OpenAI | GoogleGenAI> {
  const provider = await getActiveProvider();
  if (provider === "gemini") {
    return getGeminiClient();
  }
  if (provider === "replit") {
    return getReplitClient();
  }
  return getOpenAIClient();
}

export interface ChatCompletionResult {
  content: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

export async function generateChatCompletion(
  messages: Array<{ role: "system" | "user"; content: string }>,
  options: {
    maxTokens?: number;
    temperature?: number;
  } = {},
): Promise<ChatCompletionResult> {
  const provider = await getActiveProvider();

  if (provider === "gemini") {
    const client = await getGeminiClient();
    const model = "gemini-2.5-flash";

    const systemInstruction = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n");
    const userContent = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n\n");

    const response = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      config: {
        systemInstruction: systemInstruction || undefined,
        maxOutputTokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.7,
      },
    });

    const text = response.text ?? "";
    return {
      content: text,
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount,
        completionTokens: response.usageMetadata?.candidatesTokenCount,
        totalTokens: response.usageMetadata?.totalTokenCount,
      },
    };
  }

  // Replit path — uses Replit AI Integrations proxy (OpenAI-compatible)
  const client = provider === "replit" ? getReplitClient() : await getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: options.maxTokens ?? 2048,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const content = response.choices[0]?.message?.content ?? "";
  return {
    content,
    usage: {
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
    },
  };
}

export interface ImageGenerationResult {
  buffer: Buffer;
  mimeType: string;
}

export async function generateImage(
  prompt: string,
  size: ImageSize = "1024x1024",
): Promise<Buffer> {
  const provider = await getActiveProvider();
  const model = await getImageModel(provider);

  if (provider === "gemini") {
    const client = await getGeminiClient();
    const response = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["IMAGE"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData);
    if (imagePart?.inlineData?.data) {
      return Buffer.from(imagePart.inlineData.data, "base64");
    }
    throw new Error("No image data returned from Gemini");
  }

  // Replit or OpenAI path
  const client = provider === "replit" ? getReplitClient() : await getOpenAIClient();
  if (isGptImageModel(model)) {
    const response = await client.images.generate({
      model,
      prompt,
      size: mapSizeForGptImage(size),
    });
    const base64 = response.data?.[0]?.b64_json ?? "";
    if (!base64) throw new Error("No image data returned from AI");
    return Buffer.from(base64, "base64");
  }

  const response = await client.images.generate({
    model,
    prompt,
    size: size === "1792x1024" || size === "1024x1792" || size === "1024x1024" ? size : "1024x1024",
    ...(isDalleModel(model) ? { response_format: "b64_json" as const } : {}),
  });

  const base64 = response.data?.[0]?.b64_json ?? "";
  if (!base64) throw new Error("No image data returned from AI");
  return Buffer.from(base64, "base64");
}

export async function generateImageWithReference(
  prompt: string,
  imageFilePath: string,
  size: ImageSize = "1024x1024",
): Promise<Buffer> {
  const fs = await import("node:fs");
  const provider = await getActiveProvider();
  const model = await getImageModel(provider);

  const buffer = fs.readFileSync(imageFilePath);
  const ext = imageFilePath.toLowerCase().split(".").pop() ?? "png";
  const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";

  if (provider === "gemini") {
    const client = await getGeminiClient();
    const response = await client.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: buffer.toString("base64"), mimeType } },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseModalities: ["IMAGE"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData);
    if (imagePart?.inlineData?.data) {
      return Buffer.from(imagePart.inlineData.data, "base64");
    }
    throw new Error("No image data returned from Gemini image edit");
  }

  // Replit or OpenAI path
  const client = provider === "replit" ? getReplitClient() : await getOpenAIClient();
  const editParams: {
    model: string;
    image: File[];
    prompt: string;
    size?: "1024x1024" | "1536x1024" | "1024x1536" | "auto";
  } = {
    model,
    image: [new File([buffer], require("node:path").basename(imageFilePath), { type: mimeType })],
    prompt,
  };
  if (isGptImageModel(model)) {
    editParams.size = mapSizeForGptImage(size);
  }
  const response = await client.images.edit(editParams);

  const base64 = response.data?.[0]?.b64_json ?? "";
  if (!base64) throw new Error("No image data returned from AI image edit");
  return Buffer.from(base64, "base64");
}

export async function editImages(
  imageFiles: string[],
  prompt: string,
  outputPath?: string,
): Promise<Buffer> {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const provider = await getActiveProvider();
  const model = await getImageModel(provider);

  const images = await Promise.all(
    imageFiles.map((file) => {
      const buffer = fs.readFileSync(file);
      const ext = file.toLowerCase().split(".").pop() ?? "png";
      const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
      return { buffer, mimeType, filename: path.basename(file) };
    }),
  );

  if (provider === "gemini") {
    const client = await getGeminiClient();
    type GeminiPart = { inlineData?: { data: string; mimeType: string }; text?: string };
    const parts: GeminiPart[] = images.map((img) => ({
      inlineData: { data: img.buffer.toString("base64"), mimeType: img.mimeType },
    }));
    parts.push({ text: prompt });

    const response = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE"],
      },
    });

    const respParts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = respParts.find((p) => p.inlineData);
    if (imagePart?.inlineData?.data) {
      const imageBytes = Buffer.from(imagePart.inlineData.data, "base64");
      if (outputPath) {
        fs.writeFileSync(outputPath, imageBytes);
      }
      return imageBytes;
    }
    throw new Error("No image data returned from Gemini image edit");
  }

  // Replit or OpenAI path
  const client = provider === "replit" ? getReplitClient() : await getOpenAIClient();
  const response = await client.images.edit({
    model,
    image: images.map(
      (img) => new File([img.buffer], img.filename, { type: img.mimeType }),
    ),
    prompt,
  });

  const base64 = response.data?.[0]?.b64_json ?? "";
  const imageBytes = Buffer.from(base64, "base64");
  if (outputPath) {
    fs.writeFileSync(outputPath, imageBytes);
  }
  return imageBytes;
}
