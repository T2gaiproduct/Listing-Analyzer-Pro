import fs from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";
import { getOpenAIClient } from "./openai-client";

export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "1792x1024" | "1024x1792" | "512x512" | "256x256" = "1024x1024",
): Promise<Buffer> {
  const openai = await getOpenAIClient();
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    size: size as "1024x1024",
  });
  const base64 = response.data?.[0]?.b64_json ?? "";
  return Buffer.from(base64, "base64");
}

export async function generateImageWithReference(
  prompt: string,
  imageFilePath: string,
  size: "1024x1024" | "1792x1024" | "1024x1792" | "512x512" | "256x256" = "1024x1024",
): Promise<Buffer> {
  const openai = await getOpenAIClient();
  const buffer = fs.readFileSync(imageFilePath);
  const ext = imageFilePath.toLowerCase().split(".").pop() ?? "png";
  const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";

  const response = await openai.images.edit({
    model: "dall-e-3",
    image: [new File([buffer], path.basename(imageFilePath), { type: mimeType })],
    prompt,
    size: size as "1024x1024",
  });

  const base64 = response.data?.[0]?.b64_json ?? "";
  return Buffer.from(base64, "base64");
}

export async function editImages(
  imageFiles: string[],
  prompt: string,
  outputPath?: string,
): Promise<Buffer> {
  const openai = await getOpenAIClient();

  const images = await Promise.all(
    imageFiles.map((file) => {
      const buffer = fs.readFileSync(file);
      const ext = file.toLowerCase().split(".").pop() ?? "png";
      const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
      return new File([buffer], path.basename(file), { type: mimeType });
    }),
  );

  const response = await openai.images.edit({
    model: "dall-e-3",
    image: images,
    prompt,
  });

  const imageBase64 = response.data?.[0]?.b64_json ?? "";
  const imageBytes = Buffer.from(imageBase64, "base64");

  if (outputPath) {
    fs.writeFileSync(outputPath, imageBytes);
  }

  return imageBytes;
}
