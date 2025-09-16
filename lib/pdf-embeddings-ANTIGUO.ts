import OpenAI from 'openai'
import { supabaseAdmin } from './supabase'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

// Interfaz para los resultados de la búsqueda de documentos PDF
interface PDFDocumentSearchResult {
  id: number;
  file_name: string;
  page_number: number;
  content: string;
  similarity: number;
}

// Función para generar embeddings (sin cambios)
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' '),
  })
  
  return response.data[0].embedding
}

// Función para búsqueda semántica en la nueva tabla `pdf_documents`
async function searchPDFDocuments(
  query: string,
  matchThreshold: number = 0.25, // Aumentamos el umbral según el prompt
  matchCount: number = 10
): Promise<{
  success: boolean;
  results: PDFDocumentSearchResult[];
  error?: string;
}> {
  try {
    console.log('🔍 Iniciando búsqueda RAG para:', query);
    
    const queryEmbedding = await generateEmbedding(query)
    console.log('📊 Embedding de la consulta generado.');

    const { data, error } = await supabaseAdmin.rpc('search_pdf_documents', {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount
    })

    if (error) {
      console.error('❌ Error en la función RPC search_pdf_documents:', error.message);
      throw new Error(`Error en la búsqueda: ${error.message}`)
    }

    console.log('✅ Búsqueda completada, resultados:', data?.length || 0);
    return {
      success: true,
      results: data || []
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('💥 Error fatal en searchPDFDocuments:', errorMessage);
    return {
      success: false,
      results: [],
      error: errorMessage
    }
  }
}

// Función para obtener el contexto RAG formateado
export async function getPDFRAGContext(query: string): Promise<{ context: string, topScore: number }> {
  const searchResult = await searchPDFDocuments(query);

  if (!searchResult.success || searchResult.results.length === 0) {
    return { context: '', topScore: 0 };
  }

  // El primer resultado es el que tiene mayor similitud porque la función SQL ordena por `similarity DESC`
  const topScore = searchResult.results[0]?.similarity || 0;

  const formattedResults = searchResult.results.map((result, index) => {
    return `Fuente ${index + 1} (Score: ${result.similarity.toFixed(2)}):
- Archivo: ${result.file_name}
- Página: ${result.page_number}
- Contenido: ${result.content}`;
  });

  const context = formattedResults.join('\n\n---\n\n');

  return { context, topScore };
}
