import fs from 'fs/promises';
import path from 'path';
import zlib from 'zlib';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

// --- TIPOS ---
interface EmbeddingMetadata {
  fileName: string;
  chunkIndex?: number;
  chunkStart?: number;
  chunkEnd?: number;
  contentType?: string;
  chunkSize?: number;
}

interface EmbeddingEntry {
  content: string;
  embedding: number[];
  metadata: EmbeddingMetadata;
}

interface EmbeddingFileStructure {
  metadata?: {
    generatedAt: string;
    model: string;
    chunkSize: number;
    chunkOverlap: number;
    totalDocuments: number;
    totalEmbeddings: number;
    embeddingDimensions: number;
    compression?: string;
  };
  embeddings: EmbeddingEntry[];
}

// --- CLASE PARA EL MODELO DE EMBEDDINGS ---
class EmbeddingModel {
  private static instance: FeatureExtractionPipeline | null = null;

  static async getInstance(): Promise<FeatureExtractionPipeline> {
    if (this.instance === null) {
      console.log('🚀 Inicializando modelo de embeddings...');
      this.instance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true,
      }) as FeatureExtractionPipeline;
      console.log('✅ Modelo de embeddings cargado.');
    }
    return this.instance;
  }
}

// --- BASE DE DATOS DE EMBEDDINGS EN MEMORIA CON CACHE ---
class EmbeddingStore {
  private static embeddings: EmbeddingEntry[] = [];
  private static isLoaded = false;
  private static fileMetadata: EmbeddingFileStructure['metadata'] | null = null;

  static async loadEmbeddings(): Promise<void> {
    if (this.isLoaded && this.embeddings.length > 0) {
      return; // Ya están cargados
    }

    try {
      console.log('📦 Cargando embeddings comprimidos...');

      // Intentar cargar archivo comprimido primero
      let filePath = path.join(process.cwd(), 'app', 'embeddings-compressed.json.gz');
      let compressedData: Buffer;

      try {
        compressedData = await fs.readFile(filePath);
        console.log('✅ Archivo comprimido encontrado');
      } catch {
        // Fallback a archivo sin comprimir
        filePath = path.join(process.cwd(), 'app', 'embeddings-compressed.json');
        console.log('⚠️ Usando archivo sin comprimir (desarrollo)');
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const data: EmbeddingFileStructure = JSON.parse(fileContent);
        this.embeddings = data.embeddings;
        this.fileMetadata = data.metadata || null;
        this.isLoaded = true;
        console.log(`✅ ${this.embeddings.length} embeddings cargados desde archivo sin comprimir.`);
        return;
      }

      // Descomprimir datos
      console.log('🔄 Descomprimiendo embeddings...');
      const jsonString = zlib.gunzipSync(compressedData).toString();
      const data: EmbeddingFileStructure = JSON.parse(jsonString);

      // Manejar diferentes estructuras de archivo
      if (data && data.embeddings && Array.isArray(data.embeddings)) {
        this.embeddings = data.embeddings;
        this.fileMetadata = data.metadata || null;
      } else if (Array.isArray(data)) {
        // Compatibilidad con formato antiguo
        this.embeddings = data as EmbeddingEntry[];
        this.fileMetadata = null;
      } else {
        throw new Error('Estructura de archivo JSON inválida');
      }

      // Validación básica de los embeddings
      if (this.embeddings.length === 0) {
        throw new Error('El archivo no contiene embeddings');
      }

      // Verificar que los embeddings tengan la estructura correcta
      const sampleEmbedding = this.embeddings[0];
      if (!sampleEmbedding.content || !Array.isArray(sampleEmbedding.embedding) || !sampleEmbedding.metadata) {
        throw new Error('Estructura de embeddings inválida');
      }

      this.isLoaded = true;
      console.log(`✅ ${this.embeddings.length} embeddings cargados y descomprimidos.`);

      if (this.fileMetadata) {
        console.log(`📊 Dimensiones: ${this.fileMetadata.embeddingDimensions}, Modelo: ${this.fileMetadata.model}`);
        if (this.fileMetadata.compression) {
          console.log(`🗜️ Compresión: ${this.fileMetadata.compression}`);
        }
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error crítico cargando embeddings:', errorMessage);
      this.embeddings = [];
      this.isLoaded = false;
      throw error;
    }
  }

  static getEmbeddings(): EmbeddingEntry[] {
    return this.embeddings;
  }

  static getMetadata(): EmbeddingFileStructure['metadata'] | null {
    return this.fileMetadata;
  }

  static isReady(): boolean {
    return this.isLoaded && this.embeddings.length > 0;
  }
}

// --- FUNCIONES DE BÚSQUEDA OPTIMIZADAS ---
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    console.warn('⚠️ Vectores de diferentes dimensiones en cosine similarity');
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function searchEmbeddings(
  query: string,
  matchCount: number = 5,
  minSimilarity: number = 0.1
): Promise<Array<{ content: string; similarity: number; metadata: EmbeddingMetadata }>> {

  try {
    await EmbeddingStore.loadEmbeddings();
  } catch (error) {
    console.error('❌ No se pudieron cargar los embeddings');
    return [];
  }

  if (!EmbeddingStore.isReady()) {
    console.warn('⚠️ No hay embeddings disponibles para la búsqueda.');
    return [];
  }

  try {
    const model = await EmbeddingModel.getInstance();
    const queryEmbeddingOutput = await model(query, { pooling: 'mean', normalize: true });
    const queryEmbedding = Array.from(queryEmbeddingOutput.data as Float32Array);

    const embeddings = EmbeddingStore.getEmbeddings();

    if (!embeddings || !Array.isArray(embeddings) || embeddings.length === 0) {
      console.error('❌ Error: embeddings no es un array válido o está vacío');
      return [];
    }

    console.log(`🔍 Buscando en ${embeddings.length} embeddings...`);

    const results = embeddings
      .map(entry => ({
        content: entry.content,
        similarity: cosineSimilarity(queryEmbedding, entry.embedding),
        metadata: entry.metadata,
      }))
      .filter(result => result.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, matchCount);

    console.log(`✅ Encontrados ${results.length} resultados relevantes`);
    return results;

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error durante la búsqueda de embeddings:', errorMessage);
    return [];
  }
}

// --- FUNCIÓN PRINCIPAL ---
export async function getCompressedRAGContext(
  query: string,
  options: {
    matchCount?: number;
    minSimilarity?: number;
    includeMetadata?: boolean;
  } = {}
): Promise<{ context: string; topScore: number; resultsCount: number }> {

  const {
    matchCount = 5,
    minSimilarity = 0.1,
    includeMetadata = true
  } = options;

  console.log('🔍 Buscando en embeddings comprimidos para:', query);

  try {
    const searchResults = await searchEmbeddings(query, matchCount, minSimilarity);

    if (searchResults.length === 0) {
      console.log('🤷 No se encontraron resultados relevantes en el corpus.');
      return {
        context: 'No se encontró información relevante en el corpus.',
        topScore: 0,
        resultsCount: 0
      };
    }

    const topScore = searchResults[0]?.similarity || 0;
    console.log(`📊 Top score: ${topScore.toFixed(3)}`);

    const formattedContext = searchResults
      .map((result, index) => {
        let source: string;
        if (result.metadata.chunkIndex !== undefined) {
          source = `[Fuente: ${result.metadata.fileName}, Chunk ${result.metadata.chunkIndex + 1}]`;
        } else {
          source = `[Fuente: ${result.metadata.fileName}]`;
        }

        let formattedResult = `### Evidencia ${index + 1} (Score: ${result.similarity.toFixed(2)})\n**Fuente:** ${source}\n\n**Contenido:**\n${result.content}`;

        if (includeMetadata && (result.metadata.chunkStart !== undefined || result.metadata.contentType)) {
          const metadataInfo = [];
          if (result.metadata.contentType) metadataInfo.push(`Tipo: ${result.metadata.contentType}`);
          if (result.metadata.chunkSize) metadataInfo.push(`Tamaño: ${result.metadata.chunkSize} chars`);

          if (metadataInfo.length > 0) {
            formattedResult += `\n\n*Metadata: ${metadataInfo.join(', ')}*`;
          }
        }

        return formattedResult;
      })
      .join('\n\n---\n\n');

    return {
      context: formattedContext,
      topScore,
      resultsCount: searchResults.length
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error en getCompressedRAGContext:', errorMessage);
    return {
      context: 'Error al acceder al corpus.',
      topScore: 0,
      resultsCount: 0
    };
  }
}

// --- FUNCIÓN DE DIAGNÓSTICO ---
export async function diagnosticCompressedEmbeddings(): Promise<{
  isLoaded: boolean;
  embeddingsCount: number;
  metadata: EmbeddingFileStructure['metadata'] | null;
  sampleContent?: string;
  compressionInfo?: string;
}> {
  try {
    await EmbeddingStore.loadEmbeddings();
    const embeddings = EmbeddingStore.getEmbeddings();
    const metadata = EmbeddingStore.getMetadata();

    return {
      isLoaded: EmbeddingStore.isReady(),
      embeddingsCount: embeddings.length,
      metadata,
      sampleContent: embeddings[0]?.content.substring(0, 100) + '...' || undefined,
      compressionInfo: metadata?.compression ? `Comprimido con ${metadata.compression}` : 'Sin compresión'
    };
  } catch (error) {
    return {
      isLoaded: false,
      embeddingsCount: 0,
      metadata: null,
      compressionInfo: 'Error al cargar'
    };
  }
}
