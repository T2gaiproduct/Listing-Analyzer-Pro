import type { ImagePromptTemplateAdmin } from "@/lib/image-prompt-templates";

export function buildImagePromptInstructionsFromTemplate(tpl: ImagePromptTemplateAdmin): string {
  const header = [
    `name: ${tpl.name} · Image prompt`,
    "skill_kind: image_prompt",
    `template_category: ${tpl.category}`,
    `template_slug: ${tpl.slug}`,
  ];
  const bodyParts = [`prompt_template: ${tpl.promptTemplate.trim()}`];
  if (tpl.headlineTemplate?.trim()) {
    bodyParts.push(`headline_template: ${tpl.headlineTemplate.trim()}`);
  }
  if (tpl.bodyTemplate?.trim()) {
    bodyParts.push(`body_template: ${tpl.bodyTemplate.trim()}`);
  }
  return `${header.join("\n")}\n---\n${bodyParts.join("\n")}`;
}

export function parseImagePromptFieldsFromInstructions(instructionsText: string): {
  promptTemplate: string;
  headlineTemplate: string;
  bodyTemplate: string;
} {
  const marker = "\n---\n";
  const idx = instructionsText.indexOf(marker);
  const body = idx >= 0 ? instructionsText.slice(idx + marker.length) : instructionsText;
  let promptTemplate = "";
  let headlineTemplate = "";
  let bodyTemplate = "";
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("prompt_template:")) {
      promptTemplate = line.slice("prompt_template:".length).trim();
    } else if (line.startsWith("headline_template:")) {
      headlineTemplate = line.slice("headline_template:".length).trim();
    } else if (line.startsWith("body_template:")) {
      bodyTemplate = line.slice("body_template:".length).trim();
    }
  }
  if (!promptTemplate && body.trim() && !body.includes("prompt_template:")) {
    promptTemplate = body.trim();
  }
  return { promptTemplate, headlineTemplate, bodyTemplate };
}
