// import fs from 'fs/promises';
// import path from 'path';
// import pdf from 'pdf-parse';
// import { pipeline, Pipeline } from '@xenova/transformers';

// // --- CONFIGURACIÓN ---
// const PDFS_DIRECTORY = path.join(__dirname, '../corpus-pdfs');
// const OUTPUT_FILE = path.join(__dirname, '../app/local-embeddings.json');
// const CHUNK_SIZE = 1000; // Caracteres por chunk. Más pequeño para mejor granularidad.
// const CHUNK_OVERLAP = 150; // Superposición para mantener contexto entre chunks.

// // Modelo de embedding ligero y eficaz que se ejecutará localmente
// const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

// // --- CLASE PARA LA GENERACIÓN DE EMBEDDINGS ---
// class EmbeddingGenerator {
//   private static instance: Pipeline | null = null;

//   static async getInstance(): Promise<Pipeline> {
//     if (this.instance === null) {
//       console.log('⏳ Inicializando el modelo de embeddings local... (esto puede tardar la primera vez)');
//       this.instance = await pipeline('feature-extraction', EMBEDDING_MODEL, {
//         quantized: true, // Usar versión cuantizada para menor uso de memoria
//       });
//       console.log('✅ Modelo de embeddings cargado.');
//     }
//     return this.instance;
//   }
// }

// // --- FUNCIÓN PRINCIPAL ---
// async function generateEmbeddings() {
//   try {
//     console.log('🚀 Iniciando el proceso de generación de embeddings locales...');

//     // 1. Verificar si el directorio de PDFs existe
//     try {
//       await fs.access(PDFS_DIRECTORY);
//     } catch (e) {
//       console.error(`
// ❌ Error: El directorio '${PDFS_DIRECTORY}' no existe.
// Por favor, crea una carpeta llamada 'corpus-pdfs' en la raíz del proyecto y coloca tus archivos PDF allí.
// `);
//       return;
//     }

//     const files = await fs.readdir(PDFS_DIRECTORY);
//     const pdfFiles = files.filter((file) => path.extname(file).toLowerCase() === '.pdf');

//     if (pdfFiles.length === 0) {
//       console.log('🤷 No se encontraron archivos PDF en el directorio `corpus-pdfs`.');
//       return;
//     }

//     console.log(`📄 Encontrados ${pdfFiles.length} archivos PDF para procesar.`);

//     const allEmbeddings = [];
//     const embedder = await EmbeddingGenerator.getInstance();

//     for (const pdfFile of pdfFiles) {
//       console.log(`
// --- 🔄 Procesando: ${pdfFile} ---
// `);
//       const filePath = path.join(PDFS_DIRECTORY, pdfFile);
//       const fileBuffer = await fs.readFile(filePath);

//       const pdfData = await pdf(fileBuffer);

//       for (let i = 0; i < pdfData.numpages; i++) {
//         const pageNumber = i + 1;
//         // Obtener texto de la página actual. pdf-parse no tiene una API directa para esto,
//         // así que lo simulamos re-parseando solo esa página, o mejor, procesamos el texto completo.
//         // Para simplificar, procesaremos el texto de la página que ya tenemos.
//         // NOTA: pdf-parse no devuelve texto por página de forma nativa y fiable. 
//         // La mejor aproximación es parsear página por página.
//         const pageParser = await pdf(fileBuffer, { max: pageNumber, min: pageNumber });
//         const text = pageParser.text;

//         if (!text || text.trim().length === 0) {
//           console.log(`  - Página ${pageNumber}: Sin texto extraíble.`);
//           continue;
//         }

//         // Dividir el texto de la página en chunks
//         const chunks: string[] = [];
//         for (let j = 0; j < text.length; j += CHUNK_SIZE - CHUNK_OVERLAP) {
//           chunks.push(text.substring(j, j + CHUNK_SIZE));
//         }

//         console.log(`  📄 Página ${pageNumber}: Dividida en ${chunks.length} chunks.`);

//         for (const chunk of chunks) {
//           if (!chunk.trim()) continue;

//           // Generar embedding para el chunk
//           const output = await embedder(chunk, { pooling: 'mean', normalize: true });
//           const embedding = Array.from(output.data as Float32Array);

//           allEmbeddings.push({
//             content: chunk,
//             embedding: embedding,
//             metadata: {
//               fileName: pdfFile,
//               pageNumber: pageNumber,
//             },
//           });
//         }
//       }
//       console.log(`  ✅ ${pdfFile} procesado.`);
//     }

//     // 4. Guardar los embeddings en el archivo JSON
//     console.log(`
// 💾 Guardando ${allEmbeddings.length} embeddings en '${OUTPUT_FILE}'...`);
//     await fs.writeFile(OUTPUT_FILE, JSON.stringify(allEmbeddings, null, 2));
//     console.log('🎉 ¡Proceso completado! El archivo de embeddings local está listo.');

//   } catch (error) {
//     console.error('💥 Error catastrófico en el proceso de generación de embeddings:', error);
//   }
// }

// generateEmbeddings();













// import fs from 'fs/promises';
// import path from 'path';
// import pdf from 'pdf-parse';
// import { pipeline, Pipeline } from '@xenova/transformers';

// // --- CONFIGURACIÓN OPTIMIZADA ---
// const PDFS_DIRECTORY = path.join(__dirname, '../corpus-pdfs');
// const OUTPUT_FILE = path.join(__dirname, '../app/local-embeddings.json');
// const CHUNK_SIZE = 800; // Reducido para mejor granularidad en temas paranormales
// const CHUNK_OVERLAP = 200; // Mayor overlap para mantener contexto
// const MIN_CHUNK_SIZE = 100; // Chunks muy pequeños no aportan contexto útil

// // Modelo optimizado para embeddings semánticos
// const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

// // --- UTILIDADES DE TEXTO ---
// function cleanText(text: string): string {
//   return text
//     .replace(/\s+/g, ' ') // Normalizar espacios en blanco
//     .replace(/\n{3,}/g, '\n\n') // Reducir saltos de línea excesivos
//     .replace(/[^\x00-\x7F]/g, '') // Remover caracteres no ASCII problemáticos
//     .trim();
// }

// function smartChunking(text: string, maxSize: number, overlap: number): Array<{ content: string, startIndex: number, endIndex: number }> {
//   const chunks = [];
//   let start = 0;
  
//   while (start < text.length) {
//     let end = Math.min(start + maxSize, text.length);
    
//     // Intentar terminar en un punto natural (oración completa)
//     if (end < text.length) {
//       // Buscar el último punto, signo de exclamación o pregunta dentro del rango
//       const lastSentenceEnd = Math.max(
//         text.lastIndexOf('.', end),
//         text.lastIndexOf('!', end),
//         text.lastIndexOf('?', end),
//         text.lastIndexOf('\n\n', end)
//       );
      
//       // Si encontramos un final de oración razonable, usarlo
//       if (lastSentenceEnd > start + maxSize * 0.5) {
//         end = lastSentenceEnd + 1;
//       }
//     }
    
//     const chunk = text.slice(start, end).trim();
    
//     if (chunk.length >= MIN_CHUNK_SIZE) {
//       chunks.push({
//         content: chunk,
//         startIndex: start,
//         endIndex: end
//       });
//     }
    
//     // Calcular próximo inicio con overlap
//     start = Math.max(start + maxSize - overlap, end);
//   }
  
//   return chunks;
// }

// // --- CLASE PARA LA GENERACIÓN DE EMBEDDINGS ---
// class EmbeddingGenerator {
//   private static instance: Pipeline | null = null;

//   static async getInstance(): Promise<Pipeline> {
//     if (this.instance === null) {
//       console.log('⏳ Inicializando modelo de embeddings...');
//       this.instance = await pipeline('feature-extraction', EMBEDDING_MODEL, {
//         quantized: true,
//         device: 'cpu', // Explícitamente usar CPU para consistencia
//       });
//       console.log('✅ Modelo de embeddings cargado.');
//     }
//     return this.instance;
//   }
// }

// // --- FUNCIÓN PRINCIPAL CORREGIDA ---
// async function generateEmbeddings() {
//   try {
//     console.log('🚀 Iniciando generación de embeddings optimizada...');

//     // 1. Verificar directorio
//     try {
//       await fs.access(PDFS_DIRECTORY);
//     } catch (e) {
//       console.error(`❌ Directorio '${PDFS_DIRECTORY}' no existe. Créalo y coloca los PDFs allí.`);
//       return;
//     }

//     const files = await fs.readdir(PDFS_DIRECTORY);
//     const pdfFiles = files.filter((file) => path.extname(file).toLowerCase() === '.pdf');

//     if (pdfFiles.length === 0) {
//       console.log('🤷 No se encontraron PDFs en corpus-pdfs/');
//       return;
//     }

//     console.log(`📄 Procesando ${pdfFiles.length} archivos PDF...`);

//     const allEmbeddings = [];
//     const embedder = await EmbeddingGenerator.getInstance();

//     for (const pdfFile of pdfFiles) {
//       console.log(`\n--- 🔄 Procesando: ${pdfFile} ---`);
//       const filePath = path.join(PDFS_DIRECTORY, pdfFile);
//       const fileBuffer = await fs.readFile(filePath);

//       try {
//         // Parse completo del PDF una sola vez
//         const pdfData = await pdf(fileBuffer, {
//           // Opciones para mejor extracción
//           max: 0, // Sin límite de páginas
//           version: 'v1.10.100' // Versión específica para consistencia
//         });

//         if (!pdfData.text || pdfData.text.trim().length === 0) {
//           console.log(`  ⚠️ ${pdfFile}: Sin texto extraíble.`);
//           continue;
//         }

//         console.log(`  📄 Extraído: ${pdfData.text.length} caracteres de ${pdfData.numpages} páginas`);

//         // Limpiar texto
//         const cleanedText = cleanText(pdfData.text);

//         // Crear chunks inteligentes
//         const chunks = smartChunking(cleanedText, CHUNK_SIZE, CHUNK_OVERLAP);
//         console.log(`  🔪 Dividido en ${chunks.length} chunks semánticos`);

//         // Generar embeddings por chunks
//         let processedChunks = 0;
//         for (const chunk of chunks) {
//           try {
//             const output = await embedder(chunk.content, {
//               pooling: 'mean',
//               normalize: true
//             });
            
//             const embedding = Array.from(output.data as Float32Array);

//             allEmbeddings.push({
//               content: chunk.content,
//               embedding: embedding,
//               metadata: {
//                 fileName: pdfFile.replace('.pdf', ''), // Sin extensión para consistencia
//                 documentLength: pdfData.text.length,
//                 chunkIndex: processedChunks,
//                 chunkStart: chunk.startIndex,
//                 chunkEnd: chunk.endIndex,
//                 totalPages: pdfData.numpages,
//                 // Agregar metadata útil para paranormal/conspiracy content
//                 contentType: 'transcript', // Asumiendo que son transcripciones
//                 chunkSize: chunk.content.length
//               },
//             });

//             processedChunks++;

//             // Mostrar progreso cada 10 chunks
//             if (processedChunks % 10 === 0) {
//               console.log(`    ⚡ Procesados ${processedChunks}/${chunks.length} chunks`);
//             }

//           } catch (embeddingError) {
//             console.warn(`    ⚠️ Error en chunk ${processedChunks}:`, embeddingError.message);
//             continue;
//           }
//         }

//         console.log(`  ✅ ${pdfFile}: ${processedChunks} chunks procesados exitosamente`);

//       } catch (pdfError) {
//         console.error(`  ❌ Error procesando ${pdfFile}:`, pdfError.message);
//         continue;
//       }
//     }

//     // 4. Guardar embeddings con metadata adicional
//     const outputData = {
//       metadata: {
//         generatedAt: new Date().toISOString(),
//         model: EMBEDDING_MODEL,
//         chunkSize: CHUNK_SIZE,
//         chunkOverlap: CHUNK_OVERLAP,
//         totalDocuments: pdfFiles.length,
//         totalEmbeddings: allEmbeddings.length,
//         embeddingDimensions: allEmbeddings[0]?.embedding.length || 0
//       },
//       embeddings: allEmbeddings
//     };

//     console.log(`\n💾 Guardando ${allEmbeddings.length} embeddings...`);
//     await fs.writeFile(OUTPUT_FILE, JSON.stringify(outputData, null, 2));
    
//     console.log(`🎉 ¡Completado!
// 📊 Estadísticas:
//    - Documentos: ${pdfFiles.length}
//    - Embeddings: ${allEmbeddings.length}
//    - Dimensiones: ${outputData.metadata.embeddingDimensions}
//    - Archivo: ${OUTPUT_FILE}`);

//   } catch (error) {
//     console.error('💥 Error catastrófico:', error);
//   }
// }

// // --- FUNCIÓN DE VALIDACIÓN (OPCIONAL) ---
// async function validateEmbeddings() {
//   try {
//     const data = JSON.parse(await fs.readFile(OUTPUT_FILE, 'utf-8'));
//     console.log('🔍 Validando embeddings...');
//     console.log(`   - Total: ${data.embeddings.length}`);
//     console.log(`   - Dimensiones: ${data.metadata.embeddingDimensions}`);
    
//     // Verificar que no hay embeddings vacíos o malformados
//     const validEmbeddings = data.embeddings.filter((e: any) => 
//       e.embedding && e.embedding.length === data.metadata.embeddingDimensions
//     );
    
//     console.log(`   - Válidos: ${validEmbeddings.length}`);
//     console.log(`   - Inválidos: ${data.embeddings.length - validEmbeddings.length}`);
    
//   } catch (error) {
//     console.error('❌ Error validando embeddings:', error);
//   }
// }

// // Ejecutar
// generateEmbeddings().then(() => {
//   console.log('\n🔍 Ejecutando validación...');
//   validateEmbeddings();
// });





import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

// --- CONFIGURACIÓN OPTIMIZADA ---
const PDFS_DIRECTORY = path.join(__dirname, '../corpus-pdfs');
const OUTPUT_FILE = path.join(__dirname, '../app/local-embeddings.json');
const CHUNK_SIZE = 800; // Reducido para mejor granularidad en temas paranormales
const CHUNK_OVERLAP = 200; // Mayor overlap para mantener contexto
const MIN_CHUNK_SIZE = 100; // Chunks muy pequeños no aportan contexto útil

// Modelo optimizado para embeddings semánticos
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

// --- UTILIDADES DE TEXTO ---
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Normalizar espacios en blanco
    .replace(/\n{3,}/g, '\n\n') // Reducir saltos de línea excesivos
    .replace(/[^\x00-\x7F]/g, '') // Remover caracteres no ASCII problemáticos
    .trim();
}

function smartChunking(text: string, maxSize: number, overlap: number): Array<{ content: string, startIndex: number, endIndex: number }> {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    let end = Math.min(start + maxSize, text.length);
    
    // Intentar terminar en un punto natural (oración completa)
    if (end < text.length) {
      // Buscar el último punto, signo de exclamación o pregunta dentro del rango
      const lastSentenceEnd = Math.max(
        text.lastIndexOf('.', end),
        text.lastIndexOf('!', end),
        text.lastIndexOf('?', end),
        text.lastIndexOf('\n\n', end)
      );
      
      // Si encontramos un final de oración razonable, usarlo
      if (lastSentenceEnd > start + maxSize * 0.5) {
        end = lastSentenceEnd + 1;
      }
    }
    
    const chunk = text.slice(start, end).trim();
    
    if (chunk.length >= MIN_CHUNK_SIZE) {
      chunks.push({
        content: chunk,
        startIndex: start,
        endIndex: end
      });
    }
    
    // Calcular próximo inicio con overlap
    start = Math.max(start + maxSize - overlap, end);
  }
  
  return chunks;
}

// --- CLASE PARA LA GENERACIÓN DE EMBEDDINGS ---
class EmbeddingGenerator {
  private static instance: FeatureExtractionPipeline | null = null;

  static async getInstance(): Promise<FeatureExtractionPipeline> {
    if (this.instance === null) {
      console.log('⏳ Inicializando modelo de embeddings...');
      this.instance = await pipeline('feature-extraction', EMBEDDING_MODEL, {
        quantized: true,
        // Removemos 'device' ya que no existe en PretrainedOptions
      }) as FeatureExtractionPipeline;
      console.log('✅ Modelo de embeddings cargado.');
    }
    return this.instance;
  }
}

// --- FUNCIÓN PRINCIPAL CORREGIDA ---
async function generateEmbeddings() {
  try {
    console.log('🚀 Iniciando generación de embeddings optimizada...');

    // 1. Verificar directorio
    try {
      await fs.access(PDFS_DIRECTORY);
    } catch (e) {
      console.error(`❌ Directorio '${PDFS_DIRECTORY}' no existe. Créalo y coloca los PDFs allí.`);
      return;
    }

    const files = await fs.readdir(PDFS_DIRECTORY);
    const pdfFiles = files.filter((file) => path.extname(file).toLowerCase() === '.pdf');

    if (pdfFiles.length === 0) {
      console.log('🤷 No se encontraron PDFs en corpus-pdfs/');
      return;
    }

    console.log(`📄 Procesando ${pdfFiles.length} archivos PDF...`);

    const allEmbeddings = [];
    const embedder = await EmbeddingGenerator.getInstance();

    for (const pdfFile of pdfFiles) {
      console.log(`\n--- 🔄 Procesando: ${pdfFile} ---`);
      const filePath = path.join(PDFS_DIRECTORY, pdfFile);
      const fileBuffer = await fs.readFile(filePath);

      try {
        // Parse completo del PDF una sola vez
        const pdfData = await pdf(fileBuffer, {
          // Opciones para mejor extracción
          max: 0, // Sin límite de páginas
          version: 'v1.10.100' // Versión específica para consistencia
        });

        if (!pdfData.text || pdfData.text.trim().length === 0) {
          console.log(`  ⚠️ ${pdfFile}: Sin texto extraíble.`);
          continue;
        }

        console.log(`  📄 Extraído: ${pdfData.text.length} caracteres de ${pdfData.numpages} páginas`);

        // Limpiar texto
        const cleanedText = cleanText(pdfData.text);

        // Crear chunks inteligentes
        const chunks = smartChunking(cleanedText, CHUNK_SIZE, CHUNK_OVERLAP);
        console.log(`  🔪 Dividido en ${chunks.length} chunks semánticos`);

        // Generar embeddings por chunks
        let processedChunks = 0;
        for (const chunk of chunks) {
          try {
            const output = await embedder(chunk.content, {
              pooling: 'mean',
              normalize: true
            });
            
            const embedding = Array.from(output.data as Float32Array);

            allEmbeddings.push({
              content: chunk.content,
              embedding: embedding,
              metadata: {
                fileName: pdfFile.replace('.pdf', ''), // Sin extensión para consistencia
                documentLength: pdfData.text.length,
                chunkIndex: processedChunks,
                chunkStart: chunk.startIndex,
                chunkEnd: chunk.endIndex,
                totalPages: pdfData.numpages,
                // Agregar metadata útil para paranormal/conspiracy content
                contentType: 'transcript', // Asumiendo que son transcripciones
                chunkSize: chunk.content.length
              },
            });

            processedChunks++;

            // Mostrar progreso cada 10 chunks
            if (processedChunks % 10 === 0) {
              console.log(`    ⚡ Procesados ${processedChunks}/${chunks.length} chunks`);
            }

          } catch (embeddingError: unknown) {
            const errorMessage = embeddingError instanceof Error ? embeddingError.message : String(embeddingError);
            console.warn(`    ⚠️ Error en chunk ${processedChunks}:`, errorMessage);
            continue;
          }
        }

        console.log(`  ✅ ${pdfFile}: ${processedChunks} chunks procesados exitosamente`);

      } catch (pdfError: unknown) {
        const errorMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
        console.error(`  ❌ Error procesando ${pdfFile}:`, errorMessage);
        continue;
      }
    }

    // 4. Guardar embeddings con metadata adicional
    const outputData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        model: EMBEDDING_MODEL,
        chunkSize: CHUNK_SIZE,
        chunkOverlap: CHUNK_OVERLAP,
        totalDocuments: pdfFiles.length,
        totalEmbeddings: allEmbeddings.length,
        embeddingDimensions: allEmbeddings[0]?.embedding.length || 0
      },
      embeddings: allEmbeddings
    };

    console.log(`\n💾 Guardando ${allEmbeddings.length} embeddings...`);
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(outputData, null, 2));
    
    console.log(`🎉 ¡Completado!
📊 Estadísticas:
   - Documentos: ${pdfFiles.length}
   - Embeddings: ${allEmbeddings.length}
   - Dimensiones: ${outputData.metadata.embeddingDimensions}
   - Archivo: ${OUTPUT_FILE}`);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('💥 Error catastrófico:', errorMessage);
  }
}

// --- FUNCIÓN DE VALIDACIÓN (OPCIONAL) ---
async function validateEmbeddings() {
  try {
    const data = JSON.parse(await fs.readFile(OUTPUT_FILE, 'utf-8'));
    console.log('🔍 Validando embeddings...');
    console.log(`   - Total: ${data.embeddings.length}`);
    console.log(`   - Dimensiones: ${data.metadata.embeddingDimensions}`);
    
    // Verificar que no hay embeddings vacíos o malformados
    const validEmbeddings = data.embeddings.filter((e: any) => 
      e.embedding && e.embedding.length === data.metadata.embeddingDimensions
    );
    
    console.log(`   - Válidos: ${validEmbeddings.length}`);
    console.log(`   - Inválidos: ${data.embeddings.length - validEmbeddings.length}`);
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error validando embeddings:', errorMessage);
  }
}

// Ejecutar
generateEmbeddings().then(() => {
  console.log('\n🔍 Ejecutando validación...');
  validateEmbeddings();
});