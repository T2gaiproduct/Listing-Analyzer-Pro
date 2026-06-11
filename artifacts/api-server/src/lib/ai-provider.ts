import { GoogleGenAI } from "@google/genai";
import type OpenAI from "openai";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getOpenAIClient } from "./openai-client";
import { getGeminiClient } from "./gemini-client";

type AIProvider = "openai" | "gemini";

let cachedProvider: AIProvider | null = null;

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

export function clearProviderCache(): void {
  cachedProvider = null;
}

export async function getAIClient(): Promise<OpenAI | GoogleGenAI> {
  const provider = await getActiveProvider();
  if (provider === "gemini") {
    return getGeminiClient();
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

    // Gemini uses a single contents array with system instruction as config
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

  // OpenAI path
  const client = await getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-4o",
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
  _size: "1024x1024" | "1792x1024" | "1024x1792" | "512x512" | "256x256" = "1024x1024",
): Promise<Buffer> {
  const provider = await getActiveProvider();

  if (provider === "gemini") {
    const client = await getGeminiClient();
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash-image",
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

  // OpenAI path
  const client = await getOpenAIClient();
  const response = await client.images.generate({
    model: "dall-e-3",
    prompt,
    response_format: "b64_json",
  });

  const base64 = response.data?.[0]?.b64_json ?? "";
  if (!base64) throw new Error("No image data returned from OpenAI");
  return Buffer.from(base64, "base64");
}

export async function generateImageWithReference(
  prompt: string,
  imageFilePath: string,
  _size: "1024x1024" | "1792x1024" | "1024x1792" | "512x512" | "256x256" = "1024x1024",
): Promise<Buffer> {
  const fs = await import("node:fs");
  const provider = await getActiveProvider();

  const buffer = fs.readFileSync(imageFilePath);
  const ext = imageFilePath.toLowerCase().split(".").pop() ?? "png";
  const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";

  if (provider === "gemini") {
    const client = await getGeminiClient();
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash-image",
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

  // OpenAI path
  const client = await getOpenAIClient();
  const response = await client.images.edit({
    model: "dall-e-2",
    image: [new File([buffer], require("node:path").basename(imageFilePath), { type: mimeType })],
    prompt,
  });

  const base64 = response.data?.[0]?.b64_json ?? "";
  if (!base64) throw new Error("No image data returned from OpenAI image edit");
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
      model: "gemini-2.5-flash-image",
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

  // OpenAI path
  const client = await getOpenAIClient();
  const response = await client.images.edit({
    model: "dall-e-2",
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
