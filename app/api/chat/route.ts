
// // CÓDIGO ROUTE.TS COMPLETAMENTE CORREGIDO - Sin errores de tipos

// import { streamText, UIMessage, convertToModelMessages } from 'ai';
// //import { getLocalPDFRAGContextWithQuality, diagnosticEmbeddings } from '@/lib/local-pdf-retriever';
// import { getCompressedRAGContext, diagnosticCompressedEmbeddings } from '@/lib/compressed-embeddings';
// import { NextResponse } from 'next/server';

// // Allow streaming responses up to 30 seconds
// export const maxDuration = 30;

// // Extrae el texto de un mensaje del usuario, soportando distintos formatos de UIMessage
// function extractTextFromMessage(message: UIMessage): string {
//   try {
//     // 1) Si el mensaje tiene parts (formato actual de ai-sdk), extraer textos
//     const parts = (message as { parts?: unknown }).parts;
//     if (Array.isArray(parts)) {
//       const textFromParts = parts
//         .map((part: unknown) => {
//           if (typeof part === 'string') return part;
//           if (part && typeof part === 'object') {
//             if ('text' in part && typeof part.text === 'string') return part.text;
//             if ('content' in part && typeof part.content === 'string') return part.content;
//           }
//           return '';
//         })
//         .join(' ')
//         .trim();
//       if (textFromParts) return textFromParts;
//     }

//     // 2) Fallback: algunos adaptadores usan `content`
//     const content = (message as { content?: unknown }).content;
//     if (typeof content === 'string' && content.trim()) return content;
//     if (Array.isArray(content)) {
//       const textFromContent = content
//         .map((part: unknown) => {
//           if (typeof part === 'string') return part;
//           if (part && typeof part === 'object') {
//             const candidate = part as { text?: unknown; content?: unknown };
//             if (typeof candidate.text === 'string') return candidate.text;
//             if (typeof candidate.content === 'string') return candidate.content;
//           }
//           return '';
//         })
//         .join(' ')
//         .trim();
//       if (textFromContent) return textFromContent;
//     }

//     // 3) Fallback final: si hubiera una propiedad `text`
//     const maybeText = (message as { text?: unknown })?.text;
//     if (typeof maybeText === 'string' && maybeText.trim()) return maybeText;
//   } catch (e) {
//     console.warn('Error extrayendo texto del mensaje:', e);
//   }

//   return '';
// }

// export async function POST(req: Request) {
//   const { messages, model }: { messages: UIMessage[]; model: string } = await req.json();
//   console.log('Total messages:', messages?.length);

//   const lastMessage = messages[messages.length - 1];
//   console.log('Last message role:', lastMessage?.role);

//   const userQuery = extractTextFromMessage(lastMessage);

//   if (lastMessage?.role !== 'user' || !userQuery) {
//     console.log('userQuery vacío o role no es user. userQuery =', userQuery);
//     return NextResponse.json({ error: 'No se recibió una pregunta válida.' }, { status: 400 });
//   }

//   try {
//     // 1. DIAGNÓSTICO DEL SISTEMA PRIMERO
//     //const diagnostics = await diagnosticEmbeddings();
//     const diagnostics = await diagnosticCompressedEmbeddings();

//     if (!diagnostics.isLoaded || diagnostics.embeddingsCount === 0) {
//       console.error('PROBLEMA CRÍTICO: Sistema de embeddings no disponible');
//       const systemErrorReply = `SISTEMA NO DISPONIBLE

// El sistema de búsqueda en el corpus no está funcionando correctamente.

// **Estado del Sistema:**
// - Embeddings cargados: ${diagnostics.isLoaded ? 'Sí' : 'No'}
// - Total embeddings: ${diagnostics.embeddingsCount}
// - Modelo: ${diagnostics.metadata?.model || 'Desconocido'}

// **Por favor contacta al administrador del sistema.**`;

//       const result = streamText({
//         model: model,
//         messages: convertToModelMessages([{
//           role: 'user',
//           //content: systemErrorReply,
//           parts: [{  
//             type: 'text',        // CORRECCIÓN 1: Añadido 'type'
//             text: systemErrorReply,
//           }]
//         }]),
//         system: `Responde EXACTAMENTE: "${systemErrorReply}"`,
//       });

//       return result.toUIMessageStreamResponse();
//     }

//     // 2. BÚSQUEDA CON FILTRO DE CALIDAD MÁS ESTRICTA
//     console.log('Buscando en corpus para:', userQuery);

//     const { context: ragContext, topScore, resultsCount } = 
//       await getCompressedRAGContext(userQuery, {
//         matchCount: 8,           // Más resultados
//         minSimilarity: 0.20,     // Umbral más alto
//         includeMetadata: true,
//       });

//     console.log(`Resultados: ${resultsCount}, Top score: ${topScore.toFixed(3)}`);
//     console.log(`Contexto length: ${ragContext?.length || 0}`);

//     // 3. VERIFICACIÓN DE CALIDAD MÍNIMA MÁS ESTRICTA
//     if (topScore < 0.4 || !ragContext || ragContext.trim().length === 0 || resultsCount < 2) {
//       console.log(`Calidad insuficiente. Top score: ${topScore.toFixed(3)}, Resultados: ${resultsCount}`);

//       const insufficientDataReply = `INFORMACIÓN INSUFICIENTE EN EL CORPUS

// La consulta "${userQuery}" no tiene suficiente información relevante en el corpus local.

// **Estadísticas de Búsqueda:**
// - Puntuación máxima: ${topScore.toFixed(2)}/1.00
// - Resultados encontrados: ${resultsCount}
// - Total embeddings disponibles: ${diagnostics.embeddingsCount}

// **Sugerencias:**
// • Reformula tu pregunta usando términos más específicos del corpus
// • Prueba con palabras clave relacionadas al contenido paranormal/extraterrestre
// • Consulta temas como: testimonios, contactos, avistamientos, experiencias

// SOLO puedo responder basándome en el corpus local cargado.`;

//       const result = streamText({
//         model: model,
//         messages: convertToModelMessages([{
//           role: 'user',
//           //content: insufficientDataReply,
//           parts: [{ 
//             type: 'text',        // CORRECCIÓN 2: Añadido 'type'
//             text: insufficientDataReply 
//           }]
//         }]),
//         system: "Responde exactamente el mensaje proporcionado, sin agregar información externa.",
//       });

//       return result.toUIMessageStreamResponse();
//     }

//     // 4. CONSTRUCTION DE PROMPTS MÁS RESTRICTIVOS
//     console.log('Construyendo respuesta con restricciones de corpus...');

//     console.log(`Demostrando RAG: Usando ${resultsCount} resultados de embeddings con puntuación máxima: ${topScore.toFixed(3)}`);

// // Validar que el contexto proviene de embeddings
// if (!ragContext || ragContext.trim().length === 0) {
//   console.warn('RAG ERROR: Contexto vacío, embeddings no generaron resultados válidos');
// } else {
//   console.log(`RAG SUCCESS: Contexto generado exitosamente con ${ragContext.length} caracteres de embeddings`);
// }

// //     // System prompt muy restrictivo
// //     const restrictiveSystemPrompt = `ERES UN SISTEMA DE CONSULTA DE CORPUS RESTRINGIDO.

// // REGLAS CRÍTICAS INQUEBRANTABLES:
// // 1. SOLO puedes usar la información del "Contexto de Evidencia" proporcionado
// // 2. NUNCA uses conocimiento general o externo
// // 3. Si la respuesta NO está en el contexto, debes decir "No disponible en el corpus"
// // 4. SIEMPRE cita las evidencias numeradas [1], [2], etc.
// // 5. NO inventes, no asumas, no extrapoles

// // FORMATO OBLIGATORIO DE RESPUESTA:
// // - Respuesta directa basada SOLO en evidencias
// // - Lista de evidencias numeradas del corpus
// // - Si no hay suficiente información: "Información insuficiente en el corpus"

// // PROHIBIDO ABSOLUTAMENTE:
// // - Usar conocimiento general
// // - Hacer suposiciones
// // - Responder sin evidencia del contexto`;


// const restrictiveSystemPrompt = `ERES UN ASISTENTE DE CONSULTA DE CORPUS ESPECIALIZADO EN INFORMACIÓN PARANORMAL Y EXTRATERRESTRE.

// REGLAS CRÍTICAS INQUEBRANTABLES:
// 1. SOLO puedes usar la información del "Contexto de Evidencia" proporcionado.
// 2. NUNCA uses conocimiento general, externo o inventado.
// 3. Si la información NO está en el contexto, responde: "La información solicitada no está disponible en el corpus."
// 4. SIEMPRE cita las evidencias con formato numerado: [1], [2], etc.
// 5. Respuestas deben ser PROFESIONALES, CLARAS, COHERENTES, PRECISAS y CONCISAS.
// 6. NO alucines, inventes o divagues; mantén respuestas directas y basadas en evidencia.
// 7. Estructura las respuestas de manera ORDENADA: respuesta directa, análisis detallado, evidencias enumeradas.
// 8. Demuestra el uso de embeddings y RAG mostrando estadísticas de búsqueda y citas del corpus.

// FORMATO OBLIGATORIO DE RESPUESTA:
// - **Respuesta Directa:** 1-2 frases concisas basadas SOLO en evidencias.
// - **Análisis Detallado:** Explicación clara y coherente, citando [1], [2], etc.
// - **Evidencias del Corpus:** Lista numerada con citas textuales exactas (máx. 25 palabras) y fuente.
// - **Estadísticas de RAG:** Incluye puntuación de relevancia y número de resultados para demostrar el uso de embeddings.
// - Si no hay suficiente información: "Información insuficiente en el corpus."

// PROHIBIDO ABSOLUTAMENTE:
// - Usar conocimiento general o suposiciones.
// - Responder sin evidencia del contexto.
// - Alucinar o divagar.`;





// //     // Mensaje del usuario simplificado y más restrictivo
// //     const restrictiveUserMessage = `INSTRUCCIONES ESTRICTAS:

// // Responde ÚNICAMENTE usando el siguiente contexto del corpus. Si la respuesta no está aquí, di "No disponible en el corpus".

// // ### CONTEXTO DEL CORPUS:
// // ${ragContext}

// // ### PREGUNTA:
// // ${userQuery}

// // RESPUESTA REQUERIDA: Solo usando el contexto anterior, con citas [1], [2], etc. Sin conocimiento externo.`;


// const restrictiveUserMessage = `INSTRUCCIONES ESTRICTAS PARA RESPUESTA PROFESIONAL:

// Responde ÚNICAMENTE usando el siguiente contexto del corpus. Si la información no está aquí, di "La información solicitada no está disponible en el corpus".

// ### CONTEXTO DEL CORPUS (GENERADO POR RAG CON EMBEDDINGS):
// ${ragContext}

// ### PREGUNTA DEL USUARIO:
// ${userQuery}

// ### INSTRUCCIONES DE FORMATO OBLIGATORIO:
// 1. **Respuesta Directa:** 1-2 frases precisas y concisas basadas SOLO en evidencias del contexto.
// 2. **Análisis Detallado:** Explicación clara, coherente y ordenada, citando evidencias como [1], [2], etc. Mantén precisión, evita divagaciones.
// 3. **Evidencias del Corpus:** Lista numerada con citas textuales exactas (máx. 25 palabras cada una) y su fuente del corpus. Ejemplo:
//    - [1] "cita exacta" (Fuente: archivo.pdf)
//    - [2] "cita exacta" (Fuente: archivo.pdf)
// 4. **Estadísticas de RAG:** Incluye al final: "Estadísticas de búsqueda: Relevancia máxima: ${topScore.toFixed(2)}/1.00, Resultados encontrados: ${resultsCount}. Esto demuestra el uso de embeddings locales para recuperación precisa."

// RESPUESTA REQUERIDA: Solo usando el contexto anterior. Sé profesional, claro, coherente, preciso y conciso. No alucines ni inventes.`;





//     // 5. CORRECCIÓN: Construcción correcta de messagesForModel
//     const messagesForModel: UIMessage[] = [];

//     // Procesar mensajes anteriores manteniendo compatibilidad
//     if (Array.isArray(messages) && messages.length > 1) {
//       const previousMessages = messages.slice(0, -1);

//       // Convertir cada mensaje al formato esperado
//       for (const msg of previousMessages) {
//         const textContent = extractTextFromMessage(msg);
//         messagesForModel.push({
//           id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
//           role: msg.role,
//           parts: textContent ? [{ 
//             type: 'text',        // CORRECCIÓN 3: Añadido 'type'
//             text: textContent 
//           }] : []
//         });
//       }
//     }

//     // Añadir mensaje actual con contexto restrictivo
//     messagesForModel.push({
//       id: `user-msg-${Date.now()}`,
//       role: 'user',
//       parts: [{ 
//         type: 'text',        // CORRECCIÓN 4: Añadido 'type'
//         text: restrictiveUserMessage 
//       }]
//     });

//     // 6. CONFIGURACIÓN DEL MODELO MÁS RESTRICTIVA
//     const result = streamText({
//       model: model,
//       messages: convertToModelMessages(messagesForModel), // Ahora compatible
//       system: restrictiveSystemPrompt,
//       temperature: 0.01,        // Temperatura muy baja
//       topP: 0.1,               // Sampling más restrictivo
//       frequencyPenalty: 0.5,   // Penalizar repeticiones
//       presencePenalty: 0.3,    // Fomentar diversidad dentro del corpus
//       //maxTokens: 1000,       // Limitar longitud de respuesta
//     });

//     return result.toUIMessageStreamResponse();

//   } catch (error: unknown) {
//     const errorMessage = error instanceof Error ? error.message : String(error);
//     console.error('Error crítico en el endpoint:', errorMessage);

//     const errorReply = `ERROR DEL SISTEMA

// Se produjo un error técnico al procesar tu consulta.

// **Error:** ${errorMessage.substring(0, 100)}...

// **Por favor inténtalo de nuevo o contacta al administrador si el problema persiste.**`;

//     const result = streamText({
//       model: model,
//       messages: convertToModelMessages([{
//         role: 'user',
//         parts: [{ 
//           type: 'text',        // CORRECCIÓN 5: Añadido 'type'
//           text: errorReply 
//         }],
//       }]),
//       system: `Responde EXACTAMENTE: "${errorReply}"`,
//     });

//     return result.toUIMessageStreamResponse();
//   }
// }


// route.ts (OpenAI) - Versión optimizada con props y estilo unificado

import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { getCompressedRAGContext, diagnosticCompressedEmbeddings } from '@/lib/compressed-embeddings';
import { NextResponse } from 'next/server';

// Permitir streaming hasta 30 segundos
export const maxDuration = 30;

/**
 * Extrae texto desde distintos formatos de UIMessage
 */
function extractTextFromMessage(message: UIMessage): string {
  try {
    // 1) Formato con `parts`
    const parts = (message as { parts?: unknown }).parts;
    if (Array.isArray(parts)) {
      const textFromParts = parts
        .map((part: unknown) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object') {
            if ('text' in part && typeof (part as any).text === 'string') return (part as any).text;
            if ('content' in part && typeof (part as any).content === 'string') return (part as any).content;
          }
          return '';
        })
        .join(' ')
        .trim();
      if (textFromParts) return textFromParts;
    }

    // 2) Fallback: `content`
    const content = (message as { content?: unknown }).content;
    if (typeof content === 'string' && content.trim()) return content;
    if (Array.isArray(content)) {
      const textFromContent = content
        .map((part: unknown) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object') {
            const candidate = part as { text?: unknown; content?: unknown };
            if (typeof candidate.text === 'string') return candidate.text;
            if (typeof candidate.content === 'string') return candidate.content;
          }
          return '';
        })
        .join(' ')
        .trim();
      if (textFromContent) return textFromContent;
    }

    // 3) Fallback: `text`
    const maybeText = (message as { text?: unknown })?.text;
    if (typeof maybeText === 'string' && maybeText.trim()) return maybeText;
  } catch (e) {
    console.warn('Error extrayendo texto del mensaje:', e);
  }
  return '';
}

export async function POST(req: Request) {
  const { messages, model }: { messages: UIMessage[]; model: string } = await req.json();
  console.log('Total messages:', messages?.length);

  const lastMessage = messages[messages.length - 1];
  const userQuery = extractTextFromMessage(lastMessage);

  if (lastMessage?.role !== 'user' || !userQuery) {
    return NextResponse.json({ error: 'No se recibió una pregunta válida.' }, { status: 400 });
  }

  // 1. Detección de saludos básicos
  const greetings = ["hola", "buenas", "hello", "hi", "qué tal"];
  if (greetings.includes(userQuery.toLowerCase())) {
    const greetingReply = `¡Hola! 👋 Qué gusto saludarte.  

¿En qué puedo ayudarte hoy?  

Puedes preguntarme, por ejemplo:  
• Avistamientos de OVNIs 👽  
• Contactos extraterrestres 📡  
• Experiencias paranormales 🔮`;

    const result = streamText({
      model,
      messages: convertToModelMessages([{
        role: 'user',
        parts: [{ type: 'text', text: greetingReply }]
      }]),
      system: `Responde EXACTAMENTE: "${greetingReply}"`,
    });

    return result.toUIMessageStreamResponse();
  }


  try {
    // 1. Diagnóstico de embeddings
    const diagnostics = await diagnosticCompressedEmbeddings();
    if (!diagnostics.isLoaded || diagnostics.embeddingsCount === 0) {
      const systemErrorReply = `¡Hola! 👋 El sistema de búsqueda en el corpus no está disponible ahora mismo.

**🔧 Estado del Sistema:**
- Embeddings cargados: ${diagnostics.isLoaded ? '✅ Sí' : '❌ No'}
- Total documentos: ${diagnostics.embeddingsCount}
- Modelo: ${diagnostics.metadata?.model || 'Desconocido'}

Por favor, inténtalo de nuevo más tarde.`;

      const result = streamText({
        model,
        messages: convertToModelMessages([{ role: 'user', parts: [{ type: 'text', text: systemErrorReply }] }]),
        system: `Responde EXACTAMENTE: "${systemErrorReply}"`,
      });
      return result.toUIMessageStreamResponse();
    }

    // 2. Recuperación con RAG
    console.log('Buscando en corpus para:', userQuery);

    const { context: ragContext, topScore, resultsCount } =
      await getCompressedRAGContext(userQuery, {
        matchCount: 8,
        minSimilarity: 0.20,
        includeMetadata: true,
      });

    console.log(`Resultados: ${resultsCount}, Top score: ${topScore.toFixed(3)}`);

    // 3. Validación de calidad
    if (topScore < 0.4 || !ragContext?.trim() || resultsCount < 2) {
      const insufficientDataReply = `¡Hola! 👋 No encontré suficiente información en el corpus sobre "${userQuery}".

**📊 Estadísticas de búsqueda:**
- Relevancia: ${topScore.toFixed(2)}/1.00
- Resultados: ${resultsCount}
- Documentos totales: ${diagnostics.embeddingsCount}

**💡 Sugerencias:**
• Reformula tu pregunta con términos más específicos  
• Usa palabras clave del ámbito paranormal/extraterrestre  
• Ejemplos: "pleyades", "ascensión", "contacto extraterrestre"`;

      const result = streamText({
        model,
        messages: convertToModelMessages([{ role: 'user', parts: [{ type: 'text', text: insufficientDataReply }] }]),
        system: "Responde exactamente el mensaje proporcionado, sin agregar información externa.",
      });
      return result.toUIMessageStreamResponse();
    }

    // 4. Prompts restrictivos
    const restrictiveSystemPrompt = `ERES UN ASISTENTE DE CONSULTA DE CORPUS PARANORMAL Y EXTRATERRESTRE.

REGLAS:
1. Usa SOLO la información del contexto proporcionado.
2. NUNCA inventes ni uses conocimiento externo.
3. Si no hay datos, responde: "La información solicitada no está disponible en el corpus."
4. Cita evidencias con [1], [2], etc.
5. **Referencia al Corpus:** Indica de qué archivo PDF proviene la información usada en la respuesta.
6. Responde de forma clara, profesional y concisa.
7. Incluye al final estadísticas de RAG.`;

    const restrictiveUserMessage = `INSTRUCCIONES:

Responde ÚNICAMENTE usando el siguiente contexto del corpus.  

### CONTEXTO:
${ragContext}

### PREGUNTA:
${userQuery}

### FORMATO:
1. **Respuesta Directa:** breve y concisa.  
2. **Análisis Detallado:** explicación clara citando [1], [2].  
3. **Evidencias:** lista con citas exactas y fuente.  
4. **Referencia al Corpus:** Indica de qué archivo PDF proviene la información usada en la respuesta.
5. **Estadísticas RAG:** "Relevancia: ${topScore.toFixed(2)}/1.00, Resultados: ${resultsCount}".`;

    // 5. Construcción de mensajes para el modelo
    const messagesForModel: UIMessage[] = [];

    if (messages.length > 1) {
      for (const msg of messages.slice(0, -1)) {
        const textContent = extractTextFromMessage(msg);
        messagesForModel.push({
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: msg.role,
          parts: textContent ? [{ type: 'text', text: textContent }] : []
        });
      }
    }

    messagesForModel.push({
      id: `user-msg-${Date.now()}`,
      role: 'user',
      parts: [{ type: 'text', text: restrictiveUserMessage }]
    });

    // 6. Configuración del modelo
    const result = streamText({
      model,
      messages: convertToModelMessages(messagesForModel),
      system: restrictiveSystemPrompt,
      temperature: 0.01,
      topP: 0.1,
      frequencyPenalty: 0.5,
      presencePenalty: 0.3,
    });

    return result.toUIMessageStreamResponse();

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error crítico en el endpoint:', errorMessage);

    const errorReply = `Oops, se produjo un error al procesar tu consulta.

**Error:** ${errorMessage.substring(0, 100)}...

Por favor, inténtalo de nuevo más tarde.`;

    const result = streamText({
      model,
      messages: convertToModelMessages([{ role: 'user', parts: [{ type: 'text', text: errorReply }] }]),
      system: `Responde EXACTAMENTE: "${errorReply}"`,
    });

    return result.toUIMessageStreamResponse();
  }
}
