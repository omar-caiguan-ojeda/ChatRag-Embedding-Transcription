import fs from 'fs/promises';
import path from 'path';
import zlib from 'zlib';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import pdf from 'pdf-parse';

// --- CONFIGURACIÓN OPTIMIZADA ---
const PDFS_DIRECTORY = path.join(__dirname, '../corpus-pdfs');
const OUTPUT_FILE = path.join(__dirname, '../app/embeddings-compressed.json');
const CHUNK_SIZE = 600; // Reducido para mejor compresión
const CHUNK_OVERLAP = 200;
const MIN_CHUNK_SIZE = 80;

// --- CLASE PARA LA GENERACIÓN DE EMBEDDINGS ---
class EmbeddingGenerator {
  private static instance: FeatureExtractionPipeline | null = null;

  static async getInstance(): Promise<FeatureExtractionPipeline> {
    if (this.instance === null) {
      console.log('⏳ Inicializando modelo de embeddings...');
      this.instance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true,
      }) as FeatureExtractionPipeline;
      console.log('✅ Modelo de embeddings cargado.');
    }
    return this.instance;
  }
}

// --- FUNCIÓN DE COMPRESIÓN ---
async function compressEmbeddings(embeddingsData: any): Promise<Buffer> {
  const jsonString = JSON.stringify(embeddingsData);
  return new Promise((resolve, reject) => {
    zlib.gzip(jsonString, { level: 9 }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// --- FUNCIÓN DE DESCOMPRESIÓN ---
async function decompressEmbeddings(compressedData: Buffer): Promise<any> {
  return new Promise((resolve, reject) => {
    zlib.gunzip(compressedData, (err, result) => {
      if (err) reject(err);
      else resolve(JSON.parse(result.toString()));
    });
  });
}

// --- FUNCIÓN PRINCIPAL ---
async function generateCompressedEmbeddings() {
  try {
    console.log('🚀 Iniciando generación de embeddings comprimidos...');

    // 1. Verificar directorio
    try {
      await fs.access(PDFS_DIRECTORY);
    } catch (e) {
      console.error(`❌ Directorio '${PDFS_DIRECTORY}' no existe.`);
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
        // Parse completo del PDF
        const pdfData = await pdf(fileBuffer, {
          max: 0,
          version: 'v1.10.100'
        });

        if (!pdfData.text || pdfData.text.trim().length === 0) {
          console.log(`  ⚠️ ${pdfFile}: Sin texto extraíble.`);
          continue;
        }

        console.log(`  📄 Extraído: ${pdfData.text.length} caracteres`);

        // Limpiar texto
        const cleanedText = cleanText(pdfData.text);

        // Crear chunks más pequeños para mejor compresión
        const chunks = smartChunking(cleanedText, CHUNK_SIZE, CHUNK_OVERLAP);
        console.log(`  🔪 Dividido en ${chunks.length} chunks`);

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
                fileName: pdfFile.replace('.pdf', ''),
                chunkIndex: processedChunks,
                chunkStart: chunk.startIndex,
                chunkEnd: chunk.endIndex,
                contentType: 'transcript',
                chunkSize: chunk.content.length
              },
            });

            processedChunks++;

            if (processedChunks % 10 === 0) {
              console.log(`    ⚡ Procesados ${processedChunks}/${chunks.length} chunks`);
            }

          } catch (embeddingError: unknown) {
            const errorMessage = embeddingError instanceof Error ? embeddingError.message : String(embeddingError);
            console.warn(`    ⚠️ Error en chunk ${processedChunks}:`, errorMessage);
            continue;
          }
        }

        console.log(`  ✅ ${pdfFile}: ${processedChunks} chunks procesados`);

      } catch (pdfError: unknown) {
        const errorMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
        console.error(`  ❌ Error procesando ${pdfFile}:`, errorMessage);
        continue;
      }
    }

    // 4. Crear estructura final
    const outputData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        model: 'Xenova/all-MiniLM-L6-v2',
        chunkSize: CHUNK_SIZE,
        chunkOverlap: CHUNK_OVERLAP,
        totalDocuments: pdfFiles.length,
        totalEmbeddings: allEmbeddings.length,
        embeddingDimensions: 384,
        compression: 'gzip-level9'
      },
      embeddings: allEmbeddings
    };

    console.log(`\n💾 Generando archivo comprimido...`);

    // 5. Comprimir los datos
    const compressedBuffer = await compressEmbeddings(outputData);

    // 6. Guardar archivo comprimido
    await fs.writeFile(OUTPUT_FILE + '.gz', compressedBuffer);
    
    // 7. También guardar versión sin comprimir para desarrollo
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(outputData, null, 2));

    // 8. Mostrar estadísticas
    const originalSize = JSON.stringify(outputData).length;
    const compressedSize = compressedBuffer.length;
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

    console.log(`🎉 ¡Completado!
📊 Estadísticas:
   - Documentos: ${pdfFiles.length}
   - Embeddings: ${allEmbeddings.length}
   - Tamaño original: ${(originalSize / 1024 / 1024).toFixed(1)}MB
   - Tamaño comprimido: ${(compressedSize / 1024 / 1024).toFixed(1)}MB
   - Compresión: ${compressionRatio}%
   - Archivo: ${OUTPUT_FILE}.gz`);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('💥 Error catastrófico:', errorMessage);
  }
}

// --- UTILIDADES DE TEXTO ---
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\x00-\x7F]/g, '')
    .trim();
}

function smartChunking(text: string, maxSize: number, overlap: number): Array<{ content: string, startIndex: number, endIndex: number }> {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    let end = Math.min(start + maxSize, text.length);
    
    if (end < text.length) {
      const lastSentenceEnd = Math.max(
        text.lastIndexOf('.', end),
        text.lastIndexOf('!', end),
        text.lastIndexOf('?', end),
        text.lastIndexOf('\n\n', end)
      );
      
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
    
    start = Math.max(start + maxSize - overlap, end);
  }
  
  return chunks;
}

// Ejecutar
generateCompressedEmbeddings();
