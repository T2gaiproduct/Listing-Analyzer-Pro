import fs from "node:fs";
import path from "node:path";
import OpenAI, { toFile } from "openai";
import { Buffer } from "node:buffer";

if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
  throw new Error(
    "AI_INTEGRATIONS_OPENAI_BASE_URL must be set. Did you forget to provision the OpenAI AI integration?",
  );
}

if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  throw new Error(
    "AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?",
  );
}

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "1792x1024" | "1024x1792" | "512x512" | "256x256" = "1024x1024"
): Promise<Buffer> {
  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size: size as "1024x1024",
  });
  const base64 = response.data?.[0]?.b64_json ?? "";
  return Buffer.from(base64, "base64");
}

/**
 * Generate an image using the OpenAI images.generate endpoint with reference images.
 * The `reference` parameter tells the AI to use the uploaded product as visual inspiration.
 * We pass the reference image as a base64 data URI so it serializes correctly in the JSON body.
 */
export async function generateImageWithReference(
  prompt: string,
  imageFilePath: string,
  size: "1024x1024" | "1792x1024" | "1024x1792" | "512x512" | "256x256" = "1024x1024"
): Promise<Buffer> {
  const buffer = fs.readFileSync(imageFilePath);
  const ext = imageFilePath.toLowerCase().split(".").pop() ?? "png";
  const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
  const base64 = buffer.toString("base64");
  const dataUri = `data:${mimeType};base64,${base64}`;

  console.log(`[generateImageWithReference] Image path: ${imageFilePath}`);
  console.log(`[generateImageWithReference] Image size: ${buffer.length} bytes, MIME: ${mimeType}`);
  console.log(`[generateImageWithReference] Data URI length: ${dataUri.length} chars, prefix: ${dataUri.substring(0, 60)}...`);
  console.log(`[generateImageWithReference] Prompt: ${prompt.substring(0, 120)}...`);

  const requestBody = {
    model: "gpt-image-1",
    prompt,
    size: size as "1024x1024",
    reference: [dataUri],
  };
  console.log(`[generateImageWithReference] Request body keys: ${Object.keys(requestBody).join(", ")}`);
  console.log(`[generateImageWithReference] Has reference: ${"reference" in requestBody}, reference length: ${requestBody.reference[0].length}`);

  const response = await openai.images.generate(requestBody as any);

  console.log(`[generateImageWithReference] Response data length: ${response.data?.length ?? 0}`);
  console.log(`[generateImageWithReference] Response has b64_json: ${!!response.data?.[0]?.b64_json}`);

  const b64 = response.data?.[0]?.b64_json ?? "";
  return Buffer.from(b64, "base64");
}

export async function editImages(
  imageFiles: string[],
  prompt: string,
  outputPath?: string
): Promise<Buffer> {
  const images = await Promise.all(
    imageFiles.map((file) => {
      const buffer = fs.readFileSync(file);
      const ext = file.toLowerCase().split(".").pop() ?? "png";
      const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
      return toFile(buffer, path.basename(file), { type: mimeType });
    })
  );

  const response = await openai.images.edit({
    model: "gpt-image-1",
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
