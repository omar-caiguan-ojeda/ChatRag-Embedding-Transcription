// import OpenAI from 'openai'
// import { supabaseAdmin } from './supabase'

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY!,
// })

// // Interfaz para los resultados de la búsqueda de documentos PDF
// interface PDFDocumentSearchResult {
//   id: number;
//   file_name: string;
//   page_number: number;
//   content: string;
//   similarity: number;
// }

// // Función para generar embeddings (sin cambios)
// async function generateEmbedding(text: string): Promise<number[]> {
//   const response = await openai.embeddings.create({
//     model: 'text-embedding-3-small',  // ✅ Mantener este modelo
//     input: text.replace(/\n/g, ' '),
//   })
  
//   return response.data[0].embedding
// }

// // Función para búsqueda semántica en la nueva tabla `pdf_documents`
// async function searchPDFDocuments(
//   query: string,
//   matchThreshold: number = 0.3, // ✅ Reducido de 0.25 para ser más permisivo
//   matchCount: number = 6        // ✅ Aumentado para el prompt
// ): Promise<{
//   success: boolean;
//   results: PDFDocumentSearchResult[];
//   error?: string;
// }> {
//   try {
//     console.log('🔍 Iniciando búsqueda RAG para:', query);
    
//     const queryEmbedding = await generateEmbedding(query)
//     console.log('📊 Embedding de la consulta generado.');

//     const { data, error } = await supabaseAdmin.rpc('search_pdf_documents', {
//       query_embedding: queryEmbedding,
//       match_threshold: matchThreshold,
//       match_count: matchCount
//     })

//     if (error) {
//       console.error('❌ Error en la función RPC search_pdf_documents:', error.message);
//       throw new Error(`Error en la búsqueda: ${error.message}`)
//     }

//     console.log('✅ Búsqueda completada, resultados:', data?.length || 0);
//     console.log('📊 Top score:', data?.[0]?.similarity || 0);
    
//     return {
//       success: true,
//       results: data || []
//     }

//   } catch (error) {
//     const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
//     console.error('💥 Error fatal en searchPDFDocuments:', errorMessage);
//     return {
//       success: false,
//       results: [],
//       error: errorMessage
//     }
//   }
// }

// // ✅ FUNCIÓN CORREGIDA: Formato JSON estructurado para el prompt
// export async function getPDFRAGContext(query: string): Promise<{ context: string, topScore: number }> {
//   const searchResult = await searchPDFDocuments(query);

//   if (!searchResult.success || searchResult.results.length === 0) {
//     console.log('❌ No se encontraron resultados RAG');
//     return { context: '', topScore: 0 };
//   }

//   // El primer resultado es el que tiene mayor similitud
//   const topScore = searchResult.results[0]?.similarity || 0;
//   console.log('🎯 Top score obtenido:', topScore);

//   // ✅ FORMATO CORREGIDO: Estructurar como JSON para el prompt
//   const structuredMatches = searchResult.results.map((result, index) => ({
//     chunk_text: result.content,
//     short_summary: result.content.substring(0, 100) + '...',
//     file_name: result.file_name,
//     page_number: result.page_number || 'N/A',
//     chunk_id: `${result.file_name.replace('.pdf', '')}_p${result.page_number || 0}_c${index + 1}`,
//     score: parseFloat(result.similarity.toFixed(3))
//   }));

//   // ✅ Convertir a JSON string para el prompt
//   const context = JSON.stringify(structuredMatches, null, 2);
  
//   console.log('📋 Contexto RAG generado con', structuredMatches.length, 'chunks');
//   console.log('📋 Preview primer chunk:', structuredMatches[0]?.chunk_text?.substring(0, 50) + '...');

//   return { context, topScore };
// }


import OpenAI from 'openai'
import { supabaseAdmin } from './supabase'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

interface PDFDocumentSearchResult {
  id: number;
  file_name: string;
  page_number: number;
  content: string;
  similarity: number;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' '),
  })
  
  return response.data[0].embedding
}

async function searchPDFDocuments(
  query: string,
  matchThreshold: number = 0.3,
  matchCount: number = 6
): Promise<{
  success: boolean;
  results: PDFDocumentSearchResult[];
  error?: string;
}> {
  try {
    const queryEmbedding = await generateEmbedding(query)
    const { data, error } = await supabaseAdmin.rpc('search_pdf_documents', {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount
    })

    if (error) {
      throw new Error(`Error en la búsqueda: ${error.message}`)
    }

    return {
      success: true,
      results: data || []
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return {
      success: false,
      results: [],
      error: errorMessage
    }
  }
}

export async function getPDFRAGContext(query: string): Promise<{ context: string, topScore: number }> {
  const searchResult = await searchPDFDocuments(query);

  if (!searchResult.success || searchResult.results.length === 0) {
    return { context: 'No se encontró información relevante en el corpus.', topScore: 0 };
  }

  const topScore = searchResult.results[0]?.similarity || 0;

  // Pre-formatear el contexto para que el LLM lo use directamente
  const formattedContext = searchResult.results.map((result, index) => {
    const source = `[Fuente: ${result.file_name.replace('.pdf', '')}, Página ${result.page_number || 'N/A'}]`;
    return `### Evidencia ${index + 1} (Score: ${result.similarity.toFixed(2)})\n**Fuente:** ${source}\n\n**Contenido:**\n${result.content}`;
  }).join('\n\n---\n\n');

  return { context: formattedContext, topScore };
}