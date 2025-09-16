import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { getPDFRAGContext } from '@/lib/pdf-embeddings';
import { NextResponse } from 'next/server';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Extrae el texto de un mensaje del usuario, soportando distintos formatos de UIMessage
function extractTextFromMessage(message: UIMessage): string {
  try {
    // 1) Si el mensaje tiene parts (formato actual de ai-sdk), extraer textos
    const parts = (message as { parts?: unknown }).parts;
    if (Array.isArray(parts)) {
      const textFromParts = parts
        .map((part: any) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object') {
            if ('text' in part && typeof part.text === 'string') return part.text;
            if ('content' in part && typeof part.content === 'string') return part.content;
          }
          return '';
        })
        .join(' ')
        .trim();
      if (textFromParts) return textFromParts;
    }

    // 2) Fallback: algunos adaptadores usan `content`
    const content = (message as { content?: unknown }).content;
    if (typeof content === 'string' && content.trim()) return content;
    if (Array.isArray(content)) {
      const textFromContent = content
        .map((part: any) => (typeof part === 'string' ? part : part?.text || part?.content || ''))
        .join(' ')
        .trim();
      if (textFromContent) return textFromContent;
    }

    // 3) Fallback final: si hubiera una propiedad `text`
    const maybeText = (message as any)?.text;
    if (typeof maybeText === 'string' && maybeText.trim()) return maybeText;
  } catch (e) {
    console.warn('⚠️ Error extrayendo texto del mensaje:', e);
  }
  return '';
}

export async function POST(req: Request) {
  const { messages, model }: { messages: UIMessage[]; model: string } = await req.json();

  // Logs de depuración mínimos para diagnosticar estructuras inesperadas
  console.log('📋 Total messages:', messages?.length);
  const lastMessage = messages[messages.length - 1];
  console.log('📋 Last message role:', lastMessage?.role);

  const userQuery = extractTextFromMessage(lastMessage);

  if (lastMessage?.role !== 'user' || !userQuery) {
    console.log('⚠️ userQuery vacío o role no es user. userQuery =', userQuery);
    return NextResponse.json({ error: 'No se recibió una pregunta válida.' }, { status: 400 });
  }

  // 1. Obtener contexto y score desde la base de datos
  console.log('🚀 Llamando a getPDFRAGContext para:', userQuery);
  const { context: ragContext, topScore } = await getPDFRAGContext(userQuery);
  console.log(`✅ Contexto RAG obtenido (Score: ${topScore.toFixed(2)})`);

  // 2. Implementar el protocolo de confianza del prompt
  if (topScore < 0.25) {
    const fixedReply = `No encontré evidencia suficiente en el corpus con la confianza necesaria (score más alto: ${topScore.toFixed(2)}). ¿Deseas que busque una respuesta fuera de este corpus?`;

    // Importante: usamos streamText para que el cliente useChat reciba un stream válido
    const result = streamText({
      model: model,
      // Reenviamos el historial tal cual para mantener coherencia
      messages: convertToModelMessages(messages),
      // Instruimos al modelo a responder exactamente con el mensaje fijo
      system: `Responde EXACTAMENTE con el siguiente texto y nada más, sin agregar prefacios ni comentarios: \n\n"${fixedReply}"`,
    });

    return result.toUIMessageStreamResponse();
  }

  // 3. Construir el prompt del sistema dinámicamente
  let systemPrompt = `*1. Misión y Personalidad Central* Eres un asistente de conocimiento avanzado llamado "Guía del Corpus". Tu propósito es actuar como un Arquitecto de Conocimiento y un Guía Sabio. Tu objetivo final es entregar respuestas precisas y éticas, basadas únicamente en la evidencia recuperada.\n\n*2. Protocolo de Operación Obligatorio* Sigue esta estructura de respuesta: 1. Título Breve, 2. Respuesta Directa (1-2 frases), 3. Análisis Detallado (con citas numéricas como [1], [2]), 4. Lista de "Evidencias del Corpus" (ej: 1. "Cita textual..." [Fuente: {file_name}, Página {page_number}]), 5. Opcional "Cómo se conectan estas ideas", 6. "Próximos pasos" con sugerencias.`;

  // Añadir advertencia de confianza moderada
  if (topScore >= 0.25 && topScore < 0.75) {
    systemPrompt += `\n\n*Advertencia de Baja Confianza:* Nota: La confianza de esta respuesta es moderada. Se recomienda verificar las fuentes originales.`;
  }

  // Añadir el contexto recuperado (ahora es texto plano/markdown)
  systemPrompt += `\n\n### Contexto de Evidencia (Resultados del Retriever)\nLa siguiente es la única información que debes usar para construir tu respuesta. Cada pieza de evidencia incluye su fuente. Usa el número de la evidencia (Evidencia 1, Evidencia 2, etc.) para tus citas en el texto, como [1], [2], etc.\n\n${ragContext}`;

  // 4. Ejecutar el stream con el nuevo prompt
  console.log('🔍 SystemPrompt completo enviado al modelo.');
  const result = streamText({
    model: model,
    messages: convertToModelMessages(messages),
    system: systemPrompt,
  });

  return result.toUIMessageStreamResponse();
}