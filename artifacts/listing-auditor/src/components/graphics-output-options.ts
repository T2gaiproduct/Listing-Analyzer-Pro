export type GraphicsAspectRatio = "1:1" | "3:2" | "2:3";
export type GraphicsQuality = "standard" | "hd";

export type ImageTypePromptConfig = {
  customPrompt: string;
  referenceImages: string[];
  aspectRatio: GraphicsAspectRatio;
  quality: GraphicsQuality;
};

export const DEFAULT_IMAGE_TYPE_PROMPT_CONFIG: ImageTypePromptConfig = {
  customPrompt: "",
  referenceImages: [],
  aspectRatio: "1:1",
  quality: "standard",
};

export const GRAPHICS_ASPECT_RATIOS: {
  value: GraphicsAspectRatio;
  label: string;
  size: string;
  symbol: string;
}[] = [
  { value: "1:1", label: "Square", size: "1024 × 1024", symbol: "⬜" },
  { value: "3:2", label: "Landscape", size: "1792 × 1024", symbol: "▬" },
  { value: "2:3", label: "Portrait", size: "1024 × 1792", symbol: "▮" },
];

export const GRAPHICS_QUALITY_OPTIONS: { value: GraphicsQuality; label: string; desc: string }[] = [
  { value: "standard", label: "Standard", desc: "Faster generation" },
  { value: "hd", label: "HD", desc: "Sharper detail" },
];
