/** Strip the catalog suffix from an image-prompt skill display name. */
export function stripImagePromptSkillSuffix(displayName: string): string {
  return displayName.replace(/\s*·\s*Image prompt\s*$/i, "").trim();
}

export function imagePromptSkillCatalogTitle(moduleName: string): string {
  const base = moduleName.trim();
  if (!base) return "New skill";
  if (/·\s*Image prompt\s*$/i.test(base)) return base;
  return `${base} · Image prompt`;
}

export function setSkillInstructionsNameLine(instructionsText: string, name: string): string {
  const lines = instructionsText.split("\n");
  let replaced = false;
  const next = lines.map((line) => {
    const trimmed = line.trim();
    if (!replaced && /^name\s*:/i.test(trimmed)) {
      replaced = true;
      return `name: ${name}`;
    }
    return line;
  });
  if (!replaced) return `name: ${name}\n${instructionsText}`;
  return next.join("\n");
}
