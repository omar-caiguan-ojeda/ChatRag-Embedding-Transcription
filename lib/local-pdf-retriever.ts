// import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
// import fs from 'fs/promises';
// import path from 'path';

// // --- TIPOS Y ESTRUCTURAS MEJORADAS ---
// interface EmbeddingMetadata {
//   fileName: string;
//   pageNumber?: number; // Opcional para compatibilidad con chunks
//   chunkIndex?: number;
//   chunkStart?: number;
//   chunkEnd?: number;
//   totalPages?: number;
//   contentType?: string;
//   chunkSize?: number;
// }

// interface EmbeddingEntry {
//   content: string;
//   embedding: number[];
//   metadata: EmbeddingMetadata;
// }

// interface SearchResult {
//   content: string;
//   similarity: number;
//   metadata: EmbeddingMetadata;
// }

// interface EmbeddingFileStructure {
//   metadata?: {
//     generatedAt: string;
//     model: string;
//     chunkSize: number;
//     chunkOverlap: number;
//     totalDocuments: number;
//     totalEmbeddings: number;
//     embeddingDimensions: number;
//   };
//   embeddings: EmbeddingEntry[];
// }

// // --- CLASE PARA EL MODELO DE EMBEDDINGS (SINGLETON) ---
// class EmbeddingModel {
//   private static instance: FeatureExtractionPipeline | null = null;

//   static async getInstance(): Promise<FeatureExtractionPipeline> {
//     if (this.instance === null) {
//       console.log('Inicializando el modelo de embeddings local para búsqueda...');
//       this.instance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
//         quantized: true,
//       }) as FeatureExtractionPipeline;
//       console.log('Modelo de embeddings de búsqueda cargado.');
//     }
//     return this.instance;
//   }
// }

// // --- BASE DE DATOS DE EMBEDDINGS EN MEMORIA CON CACHE ---
// class EmbeddingStore {
//   private static embeddings: EmbeddingEntry[] = [];
//   private static isLoaded = false;
//   private static fileMetadata: EmbeddingFileStructure['metadata'] | null = null;

//   static async loadEmbeddings(): Promise<void> {
//     if (this.isLoaded && this.embeddings.length > 0) {
//       return; // Ya están cargados
//     }

//     try {
//       console.log('Cargando embeddings desde el archivo JSON...');
//       const filePath = path.join(process.cwd(), 'app', 'local-embeddings.json');
      
//       // Verificar si el archivo existe
//       try {
//         await fs.access(filePath);
//       } catch {
//         throw new Error(`Archivo no encontrado: ${filePath}`);
//       }

//       const fileContent = await fs.readFile(filePath, 'utf-8');
//       const data: EmbeddingFileStructure = JSON.parse(fileContent);

//       // Manejar diferentes estructuras de archivo
//       if (data && Array.isArray(data.embeddings)) {
//         this.embeddings = data.embeddings;
//         this.fileMetadata = data.metadata || null;
//       } else if (Array.isArray(data)) {
//         // Compatibilidad con formato antiguo
//         this.embeddings = data as EmbeddingEntry[];
//         this.fileMetadata = null;
//       } else {
//         throw new Error('Estructura de archivo JSON inválida');
//       }

//       // Validación básica de los embeddings
//       if (this.embeddings.length === 0) {
//         throw new Error('El archivo no contiene embeddings');
//       }

//       // Verificar que los embeddings tengan la estructura correcta
//       const sampleEmbedding = this.embeddings[0];
//       if (!sampleEmbedding.content || !Array.isArray(sampleEmbedding.embedding) || !sampleEmbedding.metadata) {
//         throw new Error('Estructura de embeddings inválida');
//       }

//       this.isLoaded = true;
//       console.log(`${this.embeddings.length} embeddings cargados en memoria.`);
      
//       if (this.fileMetadata) {
//         console.log(`Dimensiones: ${this.fileMetadata.embeddingDimensions}, Modelo: ${this.fileMetadata.model}`);
//       }

//     } catch (error: unknown) {
//       const errorMessage = error instanceof Error ? error.message : String(error);
//       console.error('Error crítico cargando embeddings:', errorMessage);
//       this.embeddings = []; // Asegurar que quede vacío en caso de error
//       this.isLoaded = false;
//       throw error; // Re-lanzar para que el llamador pueda manejar el error
//     }
//   }

//   static getEmbeddings(): EmbeddingEntry[] {
//     return this.embeddings;
//   }

//   static getMetadata(): EmbeddingFileStructure['metadata'] | null {
//     return this.fileMetadata;
//   }

//   static isReady(): boolean {
//     return this.isLoaded && this.embeddings.length > 0;
//   }
// }

// // --- FUNCIONES DE BÚSQUEDA OPTIMIZADAS ---

// function cosineSimilarity(vecA: number[], vecB: number[]): number {
//   if (vecA.length !== vecB.length) {
//     console.warn('Vectores de diferentes dimensiones en cosine similarity');
//     return 0;
//   }

//   let dotProduct = 0;
//   let normA = 0;
//   let normB = 0;
  
//   for (let i = 0; i < vecA.length; i++) {
//     dotProduct += vecA[i] * vecB[i];
//     normA += vecA[i] * vecA[i];
//     normB += vecB[i] * vecB[i];
//   }
  
//   if (normA === 0 || normB === 0) {
//     return 0;
//   }
  
//   return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
// }

// async function searchLocalEmbeddings(
//   query: string,
//   matchCount: number = 5,
//   minSimilarity: number = 0.1
// ): Promise<SearchResult[]> {
  
//   try {
//     await EmbeddingStore.loadEmbeddings();
//   } catch (error) {
//     console.error('No se pudieron cargar los embeddings');
//     return [];
//   }

//   if (!EmbeddingStore.isReady()) {
//     console.warn('No hay embeddings locales disponibles para la búsqueda.');
//     return [];
//   }

//   try {
//     const model = await EmbeddingModel.getInstance();
//     const queryEmbeddingOutput = await model(query, { pooling: 'mean', normalize: true });
//     const queryEmbedding = Array.from(queryEmbeddingOutput.data as Float32Array);

//     const embeddings = EmbeddingStore.getEmbeddings();
    
//     console.log(`Buscando en ${embeddings.length} embeddings...`);

//     const results: SearchResult[] = embeddings
//       .map(entry => ({
//         content: entry.content,
//         similarity: cosineSimilarity(queryEmbedding, entry.embedding),
//         metadata: entry.metadata,
//       }))
//       .filter(result => result.similarity >= minSimilarity) // Filtrar resultados muy irrelevantes
//       .sort((a, b) => b.similarity - a.similarity)
//       .slice(0, matchCount);

//     console.log(`Encontrados ${results.length} resultados relevantes`);
//     return results;

//   } catch (error: unknown) {
//     const errorMessage = error instanceof Error ? error.message : String(error);
//     console.error('Error durante la búsqueda de embeddings:', errorMessage);
//     return [];
//   }
// }

// // --- FUNCIÓN ORIGINAL PARA RETROCOMPATIBILIDAD ---
// export async function getLocalPDFRAGContext(
//   query: string, 
//   options: {
//     matchCount?: number;
//     minSimilarity?: number;
//     includeMetadata?: boolean;
//   } = {}
// ): Promise<{ context: string; topScore: number; resultsCount: number }> {
  
//   const {
//     matchCount = 5,
//     minSimilarity = 0.1,
//     includeMetadata = true
//   } = options;

//   console.log('Buscando en embeddings locales para:', query);

//   try {
//     const searchResults = await searchLocalEmbeddings(query, matchCount, minSimilarity);

//     if (searchResults.length === 0) {
//       console.log('No se encontraron resultados relevantes en el corpus local.');
//       return { 
//         context: 'No se encontró información relevante en el corpus local.', 
//         topScore: 0,
//         resultsCount: 0
//       };
//     }

//     const topScore = searchResults[0]?.similarity || 0;
//     console.log(`Top score local: ${topScore.toFixed(3)}`);

//     const formattedContext = searchResults
//       .map((result, index) => {
//         // Determinar el formato de la fuente basado en la metadata disponible
//         let source: string;
//         if (result.metadata.pageNumber) {
//           source = `[Fuente: ${result.metadata.fileName}, Página ${result.metadata.pageNumber}]`;
//         } else if (result.metadata.chunkIndex !== undefined) {
//           source = `[Fuente: ${result.metadata.fileName}, Chunk ${result.metadata.chunkIndex + 1}]`;
//         } else {
//           source = `[Fuente: ${result.metadata.fileName}]`;
//         }

//         let formattedResult = `### Evidencia ${index + 1} (Score: ${result.similarity.toFixed(2)})\n**Fuente:** ${source}\n\n**Contenido:**\n${result.content}`;
        
//         // Agregar metadata adicional si se solicita y está disponible
//         if (includeMetadata && (result.metadata.chunkStart !== undefined || result.metadata.contentType)) {
//           const metadataInfo = [];
//           if (result.metadata.contentType) metadataInfo.push(`Tipo: ${result.metadata.contentType}`);
//           if (result.metadata.chunkSize) metadataInfo.push(`Tamaño: ${result.metadata.chunkSize} chars`);
          
//           if (metadataInfo.length > 0) {
//             formattedResult += `\n\n*Metadata: ${metadataInfo.join(', ')}*`;
//           }
//         }
        
//         return formattedResult;
//       })
//       .join('\n\n---\n\n');

//     return { 
//       context: formattedContext, 
//       topScore,
//       resultsCount: searchResults.length
//     };

//   } catch (error: unknown) {
//     const errorMessage = error instanceof Error ? error.message : String(error);
//     console.error('Error en getLocalPDFRAGContext:', errorMessage);
//     return { 
//       context: 'Error al acceder al corpus local.', 
//       topScore: 0,
//       resultsCount: 0
//     };
//   }
// }

// // --- FUNCIONES MEJORADAS CON FILTRO DE CALIDAD ---

// // Función mejorada para filtrar y evaluar la calidad de los resultados
// function evaluateContentQuality(result: SearchResult): {
//   score: number;
//   isUseful: boolean;
//   reason?: string;
// } {
//   const content = result.content.toLowerCase();
  
//   // Filtros de contenido de baja calidad
//   const lowQualityPatterns = [
//     /^\d+%.*reportes?.*otras? cosas?/i, // Estadísticas vagas como "95% de reportes son otras cosas"
//     /^se sabe que.*%/i, // Afirmaciones estadísticas vagas
//     /^la mayoría de.*son/i, // Generalizaciones sin contexto
//     /^según estudios/i, // Referencias a estudios sin especificar
//     /^los expertos dicen/i, // Apelación a autoridad vaga
//     /^\w{1,20}$/, // Texto muy corto (menos de 20 caracteres)
//     /^[^.!?]*[.!?]$/ // Solo una oración muy simple
//   ];

//   // Patrones de contenido útil específico
//   const highQualityPatterns = [
//     /testimonios?|experiencia|relat[oó]|narr[oó]/i, // Testimonios específicos
//     /contact[oó]|encuentro|avistamiento/i, // Experiencias de contacto
//     /abduc[ción|cion]|secuestro/i, // Experiencias de abducción
//     /nave|objeto|luz|ser|entidad/i, // Descripciones específicas
//     /lugar|fecha|hora|ubicación/i, // Details específicos
//     /nombre propio|persona específica/i // Referencias a individuos
//   ];

//   // Evaluar patrones negativos
//   for (const pattern of lowQualityPatterns) {
//     if (pattern.test(content)) {
//       return {
//         score: result.similarity * 0.3, // Penalizar fuertemente
//         isUseful: false,
//         reason: 'Contenido genérico o estadística vaga'
//       };
//     }
//   }

//   // Evaluar patrones positivos
//   let qualityBonus = 1.0;
//   for (const pattern of highQualityPatterns) {
//     if (pattern.test(content)) {
//       qualityBonus += 0.1; // Bonus por contenido específico
//     }
//   }

//   // Penalizar contenido muy corto
//   if (result.content.length < 50) {
//     qualityBonus *= 0.5;
//   }

//   // Bonus por contenido sustancial
//   if (result.content.length > 200) {
//     qualityBonus *= 1.1;
//   }

//   const adjustedScore = result.similarity * qualityBonus;

//   return {
//     score: adjustedScore,
//     isUseful: adjustedScore > 0.25, // Umbral mínimo para utilidad
//     reason: qualityBonus > 1.1 ? 'Contenido específico y detallado' : undefined
//   };
// }

// // Función mejorada de búsqueda con filtro de calidad
// async function searchLocalEmbeddingsWithQuality(
//   query: string,
//   matchCount: number = 5,
//   minSimilarity: number = 0.1
// ): Promise<SearchResult[]> {
  
//   try {
//     await EmbeddingStore.loadEmbeddings();
//   } catch (error) {
//     console.error('No se pudieron cargar los embeddings');
//     return [];
//   }

//   if (!EmbeddingStore.isReady()) {
//     console.warn('No hay embeddings locales disponibles para la búsqueda.');
//     return [];
//   }

//   try {
//     const model = await EmbeddingModel.getInstance();
//     const queryEmbeddingOutput = await model(query, { pooling: 'mean', normalize: true });
//     const queryEmbedding = Array.from(queryEmbeddingOutput.data as Float32Array);

//     const embeddings = EmbeddingStore.getEmbeddings();
    
//     console.log(`Buscando en ${embeddings.length} embeddings...`);

//     // Primera pasada: calcular similitudes básicas
//     const initialResults: SearchResult[] = embeddings
//       .map(entry => ({
//         content: entry.content,
//         similarity: cosineSimilarity(queryEmbedding, entry.embedding),
//         metadata: entry.metadata,
//       }))
//       .filter(result => result.similarity >= minSimilarity);

//     // Segunda pasada: evaluar calidad y re-puntuar
//     const qualityEvaluatedResults = initialResults
//       .map(result => {
//         const qualityEval = evaluateContentQuality(result);
//         return {
//           ...result,
//           similarity: qualityEval.score,
//           isUseful: qualityEval.isUseful,
//           qualityReason: qualityEval.reason
//         };
//       })
//       .filter(result => result.isUseful) // Filtrar contenido no útil
//       .sort((a, b) => b.similarity - a.similarity) // Re-ordenar por score ajustado
//       .slice(0, matchCount);

//     console.log(`Encontrados ${qualityEvaluatedResults.length} resultados de calidad de ${initialResults.length} iniciales`);
    
//     return qualityEvaluatedResults;

//   } catch (error: unknown) {
//     const errorMessage = error instanceof Error ? error.message : String(error);
//     console.error('Error durante la búsqueda de embeddings:', errorMessage);
//     return [];
//   }
// }

// // Función principal actualizada con filtro de calidad
// export async function getLocalPDFRAGContextWithQuality(
//   query: string, 
//   options: {
//     matchCount?: number;
//     minSimilarity?: number;
//     includeMetadata?: boolean;
//     requireHighQuality?: boolean;
//   } = {}
// ): Promise<{ context: string; topScore: number; resultsCount: number; qualityInfo?: string }> {
  
//   const {
//     matchCount = 6, // Aumentar para compensar filtrado
//     minSimilarity = 0.15,
//     includeMetadata = true,
//     requireHighQuality = true
//   } = options;

//   console.log('Buscando contenido de calidad para:', query);

//   try {
//     const searchResults = requireHighQuality 
//       ? await searchLocalEmbeddingsWithQuality(query, matchCount * 2, minSimilarity) // Buscar más para filtrar
//       : await searchLocalEmbeddings(query, matchCount, minSimilarity);

//     if (searchResults.length === 0) {
//       console.log('No se encontraron resultados de calidad en el corpus local.');
//       return { 
//         context: 'No se encontró información específica relevante en el corpus local.', 
//         topScore: 0,
//         resultsCount: 0,
//         qualityInfo: 'Sin resultados que superen los filtros de calidad'
//       };
//     }

//     const topScore = searchResults[0]?.similarity || 0;
//     console.log(`Top score ajustado por calidad: ${topScore.toFixed(3)}`);

//     // Detectar tipo de query para formato apropiado
//     const isListQuery = /nombr[ea]|list[oa]|menciona|cu[áa]les?|tipos? de|diferentes|ejemplos? de/i.test(query);

//     let formattedContext: string;
    
//     if (isListQuery && searchResults.length > 1) {
//       // Formato de lista para queries que solicitan enumeración
//       const listItems = searchResults
//         .slice(0, Math.min(5, searchResults.length)) // Máximo 5 items
//         .map((result, index) => {
//           const source = result.metadata.pageNumber 
//             ? `[${result.metadata.fileName}, Página ${result.metadata.pageNumber}]`
//             : `[${result.metadata.fileName}]`;
          
//           // Extraer la parte más relevante del contenido (primera oración completa)
//           const sentences = result.content.split(/[.!?]+/);
//           const relevantContent = sentences[0]?.trim() + (sentences.length > 1 ? '.' : '');
          
//           return `${index + 1}. **${relevantContent}** - Fuente: ${source} (Score: ${result.similarity.toFixed(2)})`;
//         })
//         .join('\n');

//       formattedContext = `### Lista de Resultados Encontrados:\n\n${listItems}`;
//     } else {
//       // Formato estándar para queries descriptivas
//       formattedContext = searchResults
//         .slice(0, matchCount)
//         .map((result, index) => {
//           const source = result.metadata.pageNumber 
//             ? `[Fuente: ${result.metadata.fileName}, Página ${result.metadata.pageNumber}]`
//             : `[Fuente: ${result.metadata.fileName}]`;

//           let formattedResult = `### Evidencia ${index + 1} (Score: ${result.similarity.toFixed(2)})\n**Fuente:** ${source}\n\n**Contenido:**\n${result.content}`;
          
//           // Agregar información de calidad si disponible
//           if ('qualityReason' in result && result.qualityReason) {
//             formattedResult += `\n\n*Calidad: ${result.qualityReason}*`;
//           }
          
//           return formattedResult;
//         })
//         .join('\n\n---\n\n');
//     }

//     return { 
//       context: formattedContext, 
//       topScore,
//       resultsCount: searchResults.length,
//       qualityInfo: `${searchResults.length} resultados de calidad filtrados`
//     };

//   } catch (error: unknown) {
//     const errorMessage = error instanceof Error ? error.message : String(error);
//     console.error('Error en getLocalPDFRAGContextWithQuality:', errorMessage);
//     return { 
//       context: 'Error al acceder al corpus local.', 
//       topScore: 0,
//       resultsCount: 0,
//       qualityInfo: 'Error en el sistema'
//     };
//   }
// }

// // --- FUNCIÓN DE DIAGNÓSTICO (ÚTIL PARA DEBUGGING) ---
// export async function diagnosticEmbeddings(): Promise<{
//   isLoaded: boolean;
//   embeddingsCount: number;
//   metadata: EmbeddingFileStructure['metadata'] | null;
//   sampleContent?: string;
// }> {
//   try {
//     await EmbeddingStore.loadEmbeddings();
//     const embeddings = EmbeddingStore.getEmbeddings();
//     const metadata = EmbeddingStore.getMetadata();
    
//     return {
//       isLoaded: EmbeddingStore.isReady(),
//       embeddingsCount: embeddings.length,
//       metadata,
//       sampleContent: embeddings[0]?.content.substring(0, 100) + '...' || undefined
//     };
//   } catch (error) {
//     return {
//       isLoaded: false,
//       embeddingsCount: 0,
//       metadata: null
//     };
//   }
// }

import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import fs from 'fs/promises';
import path from 'path';

// --- TIPOS Y ESTRUCTURAS MEJORADAS ---
interface EmbeddingMetadata {
  fileName: string;
  pageNumber?: number; // Opcional para compatibilidad con chunks
  chunkIndex?: number;
  chunkStart?: number;
  chunkEnd?: number;
  totalPages?: number;
  contentType?: string;
  chunkSize?: number;
}

interface EmbeddingEntry {
  content: string;
  embedding: number[];
  metadata: EmbeddingMetadata;
}

interface SearchResult {
  content: string;
  similarity: number;
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
  };
  embeddings: EmbeddingEntry[];
}

// --- CLASE PARA EL MODELO DE EMBEDDINGS (SINGLETON) ---
class EmbeddingModel {
  private static instance: FeatureExtractionPipeline | null = null;

  static async getInstance(): Promise<FeatureExtractionPipeline> {
    if (this.instance === null) {
      console.log('Inicializando el modelo de embeddings local para búsqueda...');
      this.instance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true,
      }) as FeatureExtractionPipeline;
      console.log('Modelo de embeddings de búsqueda cargado.');
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
      console.log('Cargando embeddings desde el archivo JSON...');
      const filePath = path.join(process.cwd(), 'app', 'local-embeddings.json');
      
      // Verificar si el archivo existe
      try {
        await fs.access(filePath);
      } catch {
        throw new Error(`Archivo no encontrado: ${filePath}`);
      }

      const fileContent = await fs.readFile(filePath, 'utf-8');
      const data: EmbeddingFileStructure = JSON.parse(fileContent);

      // Manejar diferentes estructuras de archivo
      if (data && Array.isArray(data.embeddings)) {
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
      console.log(`${this.embeddings.length} embeddings cargados en memoria.`);
      
      if (this.fileMetadata) {
        console.log(`Dimensiones: ${this.fileMetadata.embeddingDimensions}, Modelo: ${this.fileMetadata.model}`);
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error crítico cargando embeddings:', errorMessage);
      this.embeddings = []; // Asegurar que quede vacío en caso de error
      this.isLoaded = false;
      throw error; // Re-lanzar para que el llamador pueda manejar el error
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
    console.warn('Vectores de diferentes dimensiones en cosine similarity');
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

async function searchLocalEmbeddings(
  query: string,
  matchCount: number = 5,
  minSimilarity: number = 0.1
): Promise<SearchResult[]> {
  
  try {
    await EmbeddingStore.loadEmbeddings();
  } catch (error) {
    console.error('No se pudieron cargar los embeddings');
    return [];
  }

  if (!EmbeddingStore.isReady()) {
    console.warn('No hay embeddings locales disponibles para la búsqueda.');
    return [];
  }

  try {
    const model = await EmbeddingModel.getInstance();
    const queryEmbeddingOutput = await model(query, { pooling: 'mean', normalize: true });
    const queryEmbedding = Array.from(queryEmbeddingOutput.data as Float32Array);

    const embeddings = EmbeddingStore.getEmbeddings();
    
    console.log(`Buscando en ${embeddings.length} embeddings...`);

    const results: SearchResult[] = embeddings
      .map(entry => ({
        content: entry.content,
        similarity: cosineSimilarity(queryEmbedding, entry.embedding),
        metadata: entry.metadata,
      }))
      .filter(result => result.similarity >= minSimilarity) // Filtrar resultados muy irrelevantes
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, matchCount);

    console.log(`Encontrados ${results.length} resultados relevantes`);
    return results;

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error durante la búsqueda de embeddings:', errorMessage);
    return [];
  }
}

// --- FUNCIÓN ORIGINAL PARA RETROCOMPATIBILIDAD ---
export async function getLocalPDFRAGContext(
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

  console.log('Buscando en embeddings locales para:', query);

  try {
    const searchResults = await searchLocalEmbeddings(query, matchCount, minSimilarity);

    if (searchResults.length === 0) {
      console.log('No se encontraron resultados relevantes en el corpus local.');
      return { 
        context: 'No se encontró información relevante en el corpus local.', 
        topScore: 0,
        resultsCount: 0
      };
    }

    const topScore = searchResults[0]?.similarity || 0;
    console.log(`Top score local: ${topScore.toFixed(3)}`);

    const formattedContext = searchResults
      .map((result, index) => {
        // Determinar el formato de la fuente basado en la metadata disponible
        let source: string;
        if (result.metadata.pageNumber) {
          source = `[Fuente: ${result.metadata.fileName}, Página ${result.metadata.pageNumber}]`;
        } else if (result.metadata.chunkIndex !== undefined) {
          source = `[Fuente: ${result.metadata.fileName}, Chunk ${result.metadata.chunkIndex + 1}]`;
        } else {
          source = `[Fuente: ${result.metadata.fileName}]`;
        }

        let formattedResult = `### Evidencia ${index + 1} (Score: ${result.similarity.toFixed(2)})\n**Fuente:** ${source}\n\n**Contenido:**\n${result.content}`;
        
        // Agregar metadata adicional si se solicita y está disponible
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
    console.error('Error en getLocalPDFRAGContext:', errorMessage);
    return { 
      context: 'Error al acceder al corpus local.', 
      topScore: 0,
      resultsCount: 0
    };
  }
}

// --- FUNCIONES MEJORADAS CON FILTRO DE CALIDAD ---

// Función mejorada para filtrar y evaluar la calidad de los resultados
function evaluateContentQuality(result: SearchResult): {
  score: number;
  isUseful: boolean;
  reason?: string;
} {
  const content = result.content.toLowerCase();
  
  // Filtros de contenido REALMENTE inútil (más específicos)
  const lowQualityPatterns = [
    /^se sabe que \d+%.*reportes?.*otras? cosas?$/i, // Estadística específica sin contexto
    /^según estudios generales/i, // Referencias vagas a estudios
    /^los expertos dicen que$/i, // Apelación a autoridad sin contenido
    /^\w{1,15}$/, // Texto muy corto (menos de 15 caracteres)
    /^sí\.?$|^no\.?$|^tal vez\.?$/i // Respuestas de una palabra
  ];

  // Patrones de contenido específico y útil
  const highQualityPatterns = [
    /testimonios?|experiencia|relat[oó]|narr[oó]|cuent[oa]/i, // Testimonios
    /contact[oó]|encuentro|avistamiento|aparición/i, // Experiencias de contacto  
    /abduc[ción|cion]|secuestro|llevaron|tomaron/i, // Abducciones
    /nave|objeto|luz|ser|entidad|criatura/i, // Descripciones específicas
    /vio?|observ[oó]|mir[oó]|escuch[oó]/i, // Verbos de percepción
    /lugar|ubicación|ciudad|país|zona/i, // Referencias geográficas
    /año|fecha|día|noche|hora/i, // Referencias temporales
    /[A-Z][a-z]+\s+[A-Z][a-z]+/i, // Posibles nombres propios
    /razas?|especies?|tipo|clase/i, // Clasificaciones
    /tierra|planeta|sistema|galaxia|universo/i, // Referencias cósmicas
  ];

  // Evaluar solo patrones REALMENTE problemáticos
  for (const pattern of lowQualityPatterns) {
    if (pattern.test(content)) {
      return {
        score: result.similarity * 0.4, // Menos penalización
        isUseful: false,
        reason: 'Contenido muy genérico o inútil'
      };
    }
  }

  // Evaluar contenido útil
  let qualityBonus = 1.0;
  let matchingPatterns = 0;
  
  for (const pattern of highQualityPatterns) {
    if (pattern.test(content)) {
      qualityBonus += 0.05; // Bonus más pequeño pero acumulativo
      matchingPatterns++;
    }
  }

  // Bonus adicional por múltiples patrones útiles
  if (matchingPatterns >= 3) {
    qualityBonus += 0.15;
  }

  // Penalización menor por contenido corto
  if (result.content.length < 30) {
    qualityBonus *= 0.7; // Menos penalización
  }

  // Bonus por contenido sustancial
  if (result.content.length > 150) {
    qualityBonus *= 1.05;
  }

  const adjustedScore = result.similarity * qualityBonus;

  return {
    score: adjustedScore,
    isUseful: adjustedScore > 0.20, // Umbral más bajo
    reason: matchingPatterns >= 2 ? `Contenido específico (${matchingPatterns} indicadores)` : undefined
  };
}

// Función mejorada de búsqueda con filtro de calidad
async function searchLocalEmbeddingsWithQuality(
  query: string,
  matchCount: number = 5,
  minSimilarity: number = 0.1
): Promise<SearchResult[]> {
  
  try {
    await EmbeddingStore.loadEmbeddings();
  } catch (error) {
    console.error('No se pudieron cargar los embeddings');
    return [];
  }

  if (!EmbeddingStore.isReady()) {
    console.warn('No hay embeddings locales disponibles para la búsqueda.');
    return [];
  }

  try {
    const model = await EmbeddingModel.getInstance();
    const queryEmbeddingOutput = await model(query, { pooling: 'mean', normalize: true });
    const queryEmbedding = Array.from(queryEmbeddingOutput.data as Float32Array);

    const embeddings = EmbeddingStore.getEmbeddings();
    
    console.log(`Buscando en ${embeddings.length} embeddings...`);

    // Primera pasada: calcular similitudes básicas
    const initialResults: SearchResult[] = embeddings
      .map(entry => ({
        content: entry.content,
        similarity: cosineSimilarity(queryEmbedding, entry.embedding),
        metadata: entry.metadata,
      }))
      .filter(result => result.similarity >= minSimilarity);

    // Segunda pasada: evaluar calidad y re-puntuar
    const qualityEvaluatedResults = initialResults
      .map(result => {
        const qualityEval = evaluateContentQuality(result);
        return {
          ...result,
          similarity: qualityEval.score,
          isUseful: qualityEval.isUseful,
          qualityReason: qualityEval.reason
        };
      })
      .filter(result => result.isUseful) // Filtrar contenido no útil
      .sort((a, b) => b.similarity - a.similarity) // Re-ordenar por score ajustado
      .slice(0, matchCount);

    console.log(`Encontrados ${qualityEvaluatedResults.length} resultados de calidad de ${initialResults.length} iniciales`);
    
    return qualityEvaluatedResults;

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error durante la búsqueda de embeddings:', errorMessage);
    return [];
  }
}

// Función principal actualizada con filtro de calidad
export async function getLocalPDFRAGContextWithQuality(
  query: string, 
  options: {
    matchCount?: number;
    minSimilarity?: number;
    includeMetadata?: boolean;
    requireHighQuality?: boolean;
  } = {}
): Promise<{ context: string; topScore: number; resultsCount: number; qualityInfo?: string }> {
  
  const {
    matchCount = 6, // Aumentar para compensar filtrado
    minSimilarity = 0.15,
    includeMetadata = true,
    requireHighQuality = true
  } = options;

  console.log('Buscando contenido de calidad para:', query);

  try {
    const searchResults = requireHighQuality 
      ? await searchLocalEmbeddingsWithQuality(query, matchCount * 2, minSimilarity) // Buscar más para filtrar
      : await searchLocalEmbeddings(query, matchCount, minSimilarity);

    if (searchResults.length === 0) {
      console.log('No se encontraron resultados de calidad en el corpus local.');
      return { 
        context: 'No se encontró información específica relevante en el corpus local.', 
        topScore: 0,
        resultsCount: 0,
        qualityInfo: 'Sin resultados que superen los filtros de calidad'
      };
    }

    const topScore = searchResults[0]?.similarity || 0;
    console.log(`Top score ajustado por calidad: ${topScore.toFixed(3)}`);

    // Detectar tipo de query para formato apropiado
    const isListQuery = /nombr[ea]|list[oa]|menciona|cu[áa]les?|tipos? de|diferentes|ejemplos? de/i.test(query);

    let formattedContext: string;
    
    if (isListQuery && searchResults.length > 1) {
      // Formato de lista para queries que solicitan enumeración
      const listItems = searchResults
        .slice(0, Math.min(5, searchResults.length)) // Máximo 5 items
        .map((result, index) => {
          const source = result.metadata.pageNumber 
            ? `[${result.metadata.fileName}, Página ${result.metadata.pageNumber}]`
            : `[${result.metadata.fileName}]`;
          
          // Extraer la parte más relevante del contenido (primera oración completa)
          const sentences = result.content.split(/[.!?]+/);
          const relevantContent = sentences[0]?.trim() + (sentences.length > 1 ? '.' : '');
          
          return `${index + 1}. **${relevantContent}** - Fuente: ${source} (Score: ${result.similarity.toFixed(2)})`;
        })
        .join('\n');

      formattedContext = `### Lista de Resultados Encontrados:\n\n${listItems}`;
    } else {
      // Formato estándar para queries descriptivas
      formattedContext = searchResults
        .slice(0, matchCount)
        .map((result, index) => {
          const source = result.metadata.pageNumber 
            ? `[Fuente: ${result.metadata.fileName}, Página ${result.metadata.pageNumber}]`
            : `[Fuente: ${result.metadata.fileName}]`;

          let formattedResult = `### Evidencia ${index + 1} (Score: ${result.similarity.toFixed(2)})\n**Fuente:** ${source}\n\n**Contenido:**\n${result.content}`;
          
          // Agregar información de calidad si disponible
          if ('qualityReason' in result && result.qualityReason) {
            formattedResult += `\n\n*Calidad: ${result.qualityReason}*`;
          }
          
          return formattedResult;
        })
        .join('\n\n---\n\n');
    }

    return { 
      context: formattedContext, 
      topScore,
      resultsCount: searchResults.length,
      qualityInfo: `${searchResults.length} resultados de calidad filtrados`
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error en getLocalPDFRAGContextWithQuality:', errorMessage);
    return { 
      context: 'Error al acceder al corpus local.', 
      topScore: 0,
      resultsCount: 0,
      qualityInfo: 'Error en el sistema'
    };
  }
}

// --- FUNCIÓN DE DIAGNÓSTICO (ÚTIL PARA DEBUGGING) ---
export async function diagnosticEmbeddings(): Promise<{
  isLoaded: boolean;
  embeddingsCount: number;
  metadata: EmbeddingFileStructure['metadata'] | null;
  sampleContent?: string;
}> {
  try {
    await EmbeddingStore.loadEmbeddings();
    const embeddings = EmbeddingStore.getEmbeddings();
    const metadata = EmbeddingStore.getMetadata();
    
    return {
      isLoaded: EmbeddingStore.isReady(),
      embeddingsCount: embeddings.length,
      metadata,
      sampleContent: embeddings[0]?.content.substring(0, 100) + '...' || undefined
    };
  } catch (error) {
    return {
      isLoaded: false,
      embeddingsCount: 0,
      metadata: null
    };
  }
}