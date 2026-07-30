import type { GraphicsImageTypeOption } from "@/components/graphics-type-customize-ui";

export const GRAPHICS_IMAGE_TYPES: GraphicsImageTypeOption[] = [
  { id: "hero", label: "Hero Shot", desc: "White background, product centered", icon: "🏆" },
  { id: "lifestyle", label: "Lifestyle In-Use", desc: "Product in use, real environment", icon: "🌅" },
  { id: "callouts", label: "Feature Callouts", desc: "Numbered features, arrows", icon: "🔢" },
  { id: "size", label: "Size Reference", desc: "Scale comparison with dimensions", icon: "📏" },
  { id: "beforeafter", label: "Before / After", desc: "Transformation comparison", icon: "⚡" },
  { id: "bundle", label: "Bundle Shot", desc: "All included items", icon: "📦" },
  { id: "social", label: "Social Proof", desc: "Ratings & reviews", icon: "⭐" },
  { id: "custom", label: "Generate Custom", desc: "Custom prompt", icon: "✨" },
];

export const GRAPHICS_CUSTOM_PROMPT_EXAMPLES = [
  "Show the product in a modern kitchen setting with warm natural lighting",
  "Create a minimalist product shot on a marble surface with soft shadows",
  "Show product being used by a family on a beach during golden hour",
  "Flat-lay overhead shot of product with complementary lifestyle props",
  "Product on a clean desk setup with laptop and coffee, work-from-home aesthetic",
];

export const GRAPHICS_PROMPT_MAX_CHARS = 1000;
