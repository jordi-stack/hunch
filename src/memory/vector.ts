/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find top K most similar vectors from a list
 */
export function findSimilar(
  query: number[],
  vectors: Array<{ id: string; embedding: number[]; metadata?: unknown }>,
  k: number = 5
): Array<{ id: string; similarity: number; metadata?: unknown }> {
  const similarities = vectors.map((v) => ({
    id: v.id,
    similarity: cosineSimilarity(query, v.embedding),
    metadata: v.metadata,
  }));

  return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, k);
}

/**
 * Generate a simple embedding (placeholder - in production use OpenAI/etc)
 * This is a hash-based pseudo-embedding for demo purposes
 */
export function simpleEmbed(text: string, dimensions: number = 1536): number[] {
  // Simple hash-based embedding for demo
  // In production, use OpenAI Embeddings API or similar
  const embedding = new Array(dimensions).fill(0);

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    embedding[i % dimensions] += charCode / 1000;
  }

  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return embedding;
  return embedding.map((val) => val / norm);
}
