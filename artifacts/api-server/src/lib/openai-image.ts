import fs from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";
import {
  type ImageGenerateOptions,
  generateImage,
  generateImageWithReference,
  editImages,
} from "./ai-provider";

export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "1792x1024" | "1024x1792" | "512x512" | "256x256" = "1024x1024",
  options?: ImageGenerateOptions,
): Promise<Buffer> {
  return generateImage(prompt, size, options);
}

export async function generateImageWithReferenceProxy(
  prompt: string,
  imageFilePath: string,
  size: "1024x1024" | "1792x1024" | "1024x1792" | "512x512" | "256x256" = "1024x1024",
  options?: ImageGenerateOptions,
): Promise<Buffer> {
  return generateImageWithReference(prompt, imageFilePath, size, options);
}

export async function editImagesProxy(
  imageFiles: string[],
  prompt: string,
  outputPath?: string,
): Promise<Buffer> {
  return editImages(imageFiles, prompt, outputPath);
}
