const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 120;

export function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > chunkSize) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }
      for (let i = 0; i < paragraph.length; i += chunkSize - overlap) {
        chunks.push(paragraph.slice(i, i + chunkSize).trim());
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= chunkSize) {
      current = candidate;
    } else {
      if (current) chunks.push(current.trim());
      current = paragraph;
    }
  }

  if (current) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export function scoreChunkRelevance(query: string, chunk: string): number {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return 0;

  const chunkTokens = tokenize(chunk);
  if (chunkTokens.length === 0) return 0;

  let overlap = 0;
  for (const token of chunkTokens) {
    if (queryTokens.has(token)) overlap += 1;
  }

  const density = overlap / chunkTokens.length;
  const coverage = overlap / queryTokens.size;
  return density * 0.6 + coverage * 0.4;
}

export function selectTopChunks(
  query: string,
  chunks: Array<{ id: number; content: string }>,
  limit = 6,
): Array<{ id: number; content: string; score: number }> {
  return chunks
    .map((chunk) => ({
      ...chunk,
      score: scoreChunkRelevance(query, chunk.content),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
