import { OpenAIEmbeddings } from "@langchain/openai";

// Lazy initialization of embeddings to ensure env vars are loaded
let embeddings: OpenAIEmbeddings | null = null;

function getEmbeddings(): OpenAIEmbeddings {
  if (!embeddings) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      model: "text-embedding-3-small",
    });
  }
  return embeddings;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const embedding = await getEmbeddings().embedQuery(text);
  return embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddingsList = await getEmbeddings().embedDocuments(texts);
  return embeddingsList;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

export async function searchSimilarChunks(
  query: string,
  documentChunks: Array<{ content: string; embedding: number[] }>,
  topK = 5
) {
  const queryEmbedding = await generateEmbedding(query);

  const similarities = documentChunks.map((chunk) => ({
    content: chunk.content,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
