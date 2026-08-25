/** Strip common markdown emphasis so LLM output reads cleanly in plain-text chat bubbles. */
export function stripChatMarkdown(text: string): string {
  if (!text) return text;

  let result = text;
  // Bold / strong (including triple-asterisk variants)
  result = result.replace(/\*\*\*([^*]+)\*\*\*/g, "$1");
  result = result.replace(/\*\*([^*]+)\*\*/g, "$1");
  // Italic — only paired asterisks, not bullet lines starting with "* "
  result = result.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1");
  // Orphaned emphasis markers
  result = result.replace(/\*{2,}/g, "");
  return result;
}
