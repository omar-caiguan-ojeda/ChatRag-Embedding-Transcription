import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { getLocalPDFRAGContextWithQuality, diagnosticEmbeddings } from '@/lib/local-pdf-retriever';
import { NextResponse } from 'next/server';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Analizar el tono y contexto del usuario
function analyzeUserIntent(query: string): {
  intent: 'exploration' | 'specific' | 'frustrated' | 'help' | 'followup';
  emotionalTone: 'neutral' | 'frustrated' | 'curious' | 'demanding';
  suggestedApproach: string;
} {
  const queryLower = query.toLowerCase();
  
  // Detectar frustración
  if (queryLower.includes('no tienes') || queryLower.includes('nada') || 
      queryLower.includes('entonces que') || queryLower.includes('no hay') ||
      queryLower.includes('no encuentro') || queryLower.includes('utilidad')) {
    return {
      intent: 'frustrated',
      emotionalTone: 'frustrated',
      suggestedApproach: 'supportive_with_alternatives'
    };
  }

  // Detectar búsqueda de ayuda
  if (queryLower.includes('como usar') || queryLower.includes('ayuda') || 
      queryLower.includes('que puedo') || queryLower.includes('como buscar')) {
    return {
      intent: 'help',
      emotionalTone: 'curious',
      suggestedApproach: 'comprehensive_guide'
    };
  }

  // Detectar exploración general
  if (queryLower.includes('que es') || queryLower.includes('cuentame') ||
      queryLower.includes('cuales son') || queryLower.includes('tipos de')) {
    return {
      intent: 'exploration',
      emotionalTone: 'curious',
      suggestedApproach: 'engaging_narrative'
    };
  }

  return {
    intent: 'specific',
    emotionalTone: 'neutral',
    suggestedApproach: 'direct_informative'
  };
}

// Sistema de sugerencias basado en el contenido del corpus
function generateQuerySuggestions(query: string, resultsCount: number): string[] {
  const suggestions: string[] = [];
  const queryLower = query.toLowerCase();
  
  // Sugerencias basadas en temas comunes en corpus paranormal
  const topicSuggestions: Record<string, string[]> = {
    'contacto': [
      'experiencias de contacto extraterrestre',
      'testimonios de encuentros cercanos',
      'comunicación con seres de otros mundos'
    ],
    'abduccion': [
      'relatos de abducciones',
      'experiencias a bordo de naves',
      'experimentos realizados durante abducciones'
    ],
    'avistamiento': [
      'avistamientos de naves espaciales',
      'luces en el cielo testimonios',
      'objetos no identificados avistados'
    ],
    'ser': [
      'descripción de seres extraterrestres',
      'tipos de entidades encontradas',
      'características de los visitantes'
    ],
    'nave': [
      'descripciones de naves espaciales',
      'tecnología extraterrestre observada',
      'interior de las naves'
    ],
    'experiencia': [
      'experiencias paranormales documentadas',
      'testimonios de contactados',
      'relatos de encuentros extraordinarios'
    ]
  };

  // Sugerencias por tipo de pregunta
  if (queryLower.includes('que es') || queryLower.includes('qué es')) {
    suggestions.push(
      'Prueba preguntas sobre experiencias específicas en lugar de definiciones',
      'Ejemplo: "relatos sobre abducciones" en lugar de "qué es una abducción"'
    );
  }

  if (queryLower.includes('como') || queryLower.includes('cómo')) {
    suggestions.push(
      'Pregunta sobre testimonios: "testimonios de cómo ocurren los contactos"',
      'O procesos específicos: "cómo describen los contactados sus experiencias"'
    );
  }

  // Buscar temas relacionados
  for (const [topic, topicSugs] of Object.entries(topicSuggestions)) {
    if (queryLower.includes(topic)) {
      suggestions.push(...topicSugs.slice(0, 2));
      break;
    }
  }

  // Si no hay resultados, sugerir términos más específicos
  if (resultsCount === 0) {
    suggestions.push(
      'Usa términos más específicos del ámbito paranormal',
      'Prueba con: "testimonios", "relatos", "experiencias", "contactos"',
      'Pregunta sobre lugares o personas específicas mencionadas'
    );
  }

  // Sugerencias generales de mejores prácticas
  if (suggestions.length < 3) {
    suggestions.push(
      'Pregunta sobre experiencias concretas en lugar de conceptos generales',
      'Usa frases como: "testimonios sobre...", "experiencias de...", "relatos de..."'
    );
  }

  return suggestions.slice(0, 4); // Máximo 4 sugerencias
}

// Generar respuesta contextual mejorada
function generateIntelligentResponse(
  userQuery: string,
  ragContext: string,
  topScore: number,
  resultsCount: number,
  diagnostics: any,
  qualityInfo?: string
): string {
  
  const analysis = analyzeUserIntent(userQuery);
  
  // Si hay frustración, manejar de forma especial
  if (analysis.intent === 'frustrated') {
    return generateFrustrationResponse(userQuery, diagnostics, ragContext, resultsCount);
  }
  
  // Si pide ayuda
  if (analysis.intent === 'help') {
    return generateHelpResponse(diagnostics);
  }
  
  // Si hay contenido disponible
  if (ragContext && ragContext.trim().length > 0 && resultsCount > 0) {
    if (analysis.intent === 'exploration') {
      return generateEngagingNarrative(userQuery, ragContext, topScore, resultsCount);
    } else {
      return generateDirectResponse(userQuery, ragContext, topScore, resultsCount);
    }
  }
  
  // Sin contenido disponible
  return generateNoResultsWithGuidance(userQuery, diagnostics);
}

function generateFrustrationResponse(query: string, diagnostics: any, ragContext: string, resultsCount: number): string {
  const corpusThemes = [
    "Historia Alternativa: Tartaria, civilizaciones perdidas, narrativas ocultas",
    "Comunicación Extraterrestre: Mensajes de Pléyades, contactos directos", 
    "Investigación de Anomalías: Agujeros en la historia, inconsistencias",
    "Manipulación y Control: Influencias en la percepción pública",
    "Perspectivas No Convencionales: Visiones alternativas de la realidad"
  ];

  if (ragContext && resultsCount > 0) {
    const firstQuote = ragContext.match(/"([^"]+)"/)?.[1] || 'información relevante encontrada';
    
    return `Tienes razón, puedo mejorar la presentación. Déjame ser más útil:

**ENCONTRÉ INFORMACIÓN SOBRE "${query.toUpperCase()}":**

"${firstQuote}"

**CONTEXTO:** Esta información forma parte de transcripciones sobre perspectivas alternativas de la realidad.

**TEMAS RELACIONADOS DISPONIBLES:**
${corpusThemes.slice(0, 3).map(theme => `• ${theme}`).join('\n')}

**¿QUÉ TE GUSTARÍA SABER ESPECÍFICAMENTE?**
- Más detalles sobre este tema
- Las fuentes de esta información  
- Explorar un tema diferente del corpus

Total de fragmentos disponibles: ${diagnostics.embeddingsCount}`;
  }

  return `Entiendo tu frustración y tienes razón. Permíteme ser más útil.

**EL CORPUS SÍ CONTIENE INFORMACIÓN VALIOSA:**

${corpusThemes.map(theme => `• ${theme}`).join('\n')}

**CONTENIDO DISPONIBLE:** ${diagnostics.embeddingsCount} fragmentos únicos

**PREGÚNTAME DIRECTAMENTE:**
• "¿Qué es lo más interesante sobre Tartaria?"
• "¿Qué dicen sobre comunicación extraterrestre?"  
• "¿Hay información sobre manipulación histórica?"
• "Sorpréndeme con algo fascinante"

**O SIMPLEMENTE DI:** "Muéstrame algo interesante del corpus"

¿Cuál de estos temas te llama la atención?`;
}

function generateHelpResponse(diagnostics: any): string {
  return `**GUÍA COMPLETA PARA USAR EL CORPUS EFECTIVAMENTE**

**CONTENIDO DISPONIBLE (${diagnostics.embeddingsCount} fragmentos):**

**TEMAS PRINCIPALES:**
• Historia alternativa (Tartaria, civilizaciones perdidas)
• Contacto Extraterrestre: Comunicaciones de Pléyades/Taygeta  
• Manipulación Informativa: Control de narrativas
• Anomalías Históricas: Inconsistencias y agujeros
• Perspectivas Alternativas: Visiones no convencionales

**CONSULTAS EFECTIVAS:**
✅ "cuéntame sobre Tartaria"
✅ "información sobre comunicación extraterrestre"
✅ "qué perspectivas alternativas hay"
✅ "sorpréndeme con algo interesante"

**EVITAR:**
❌ "¿qué es un OVNI?" (muy general)
❌ "define abducción" (busca definiciones)

**CONSEJOS:**
• Pregunta sobre temas específicos
• Usa "cuéntame sobre..." o "qué hay sobre..."
• Si algo te interesa, pide más detalles

**PARA EMPEZAR:** "¿Qué es lo más sorprendente del corpus?"`;
}

function generateEngagingNarrative(query: string, ragContext: string, topScore: number, resultsCount: number): string {
  // Extraer citas principales
  const quotes = ragContext.match(/"([^"]+)"/g)?.slice(0, 3) || [];
  const sources = ragContext.match(/\[Fuente: ([^\]]+)\]/g)?.slice(0, 2) || [];
  
  return `**${query.toUpperCase()} - INFORMACIÓN DEL CORPUS:**

**DATOS CLAVE ENCONTRADOS:**
${quotes.map((quote, i) => `${i + 1}. ${quote}`).join('\n')}

**FUENTES:**
${sources.join(', ')}

**CONTEXTO:**
Esta información forma parte de transcripciones sobre perspectivas alternativas de la realidad y comunicaciones extraterrestres.

**ESTADÍSTICAS:**
• Relevancia: ${(topScore * 100).toFixed(0)}%
• Fuentes consultadas: ${resultsCount}

**¿QUÉ ASPECTO TE INTERESA MÁS?**
• Los detalles específicos mencionados
• Las fuentes de esta información  
• Conexiones con otros temas del corpus`;
}

function generateDirectResponse(query: string, ragContext: string, topScore: number, resultsCount: number): string {
  const quotes = ragContext.match(/"([^"]+)"/g)?.slice(0, 4) || [];
  
  return `**INFORMACIÓN ENCONTRADA: ${query.toUpperCase()}**

**DATOS PRINCIPALES:**
${quotes.map((quote, i) => `• ${quote}`).join('\n')}

**ESTADÍSTICAS:**
• Fuentes: ${resultsCount}  
• Relevancia: ${(topScore * 100).toFixed(0)}%

**¿QUIERES PROFUNDIZAR EN ALGÚN ASPECTO ESPECÍFICO?**`;
}

function generateNoResultsWithGuidance(query: string, diagnostics: any): string {
  return `**"${query}" no encontrado específicamente**

**PERO PUEDO AYUDARTE CON:**

**TEMAS DISPONIBLES:**
• Historia alternativa (Tartaria, civilizaciones perdidas)
• Comunicaciones extraterrestres (Pléyades, contactos)  
• Anomalías históricas (agujeros en narrativas)
• Manipulación informativa (control de percepción)

**TOTAL:** ${diagnostics.embeddingsCount} fragmentos disponibles

**PRUEBA PREGUNTANDO:**
• "¿Qué hay sobre historia alternativa?"
• "Información sobre contactos extraterrestres"  
• "Sorpréndeme con algo interesante"

¿Cuál de estos temas te interesa explorar?`;
}

// Extrae el texto de un mensaje del usuario, soportando distintos formatos de UIMessage
function extractTextFromMessage(message: UIMessage): string {
  try {
    // 1) Si el mensaje tiene parts (formato actual de ai-sdk), extraer textos
    const parts = (message as { parts?: unknown }).parts;
    if (Array.isArray(parts)) {
      const textFromParts = parts
        .map((part: unknown) => {
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

    // 3) Fallback final: si hubiera una propiedad `text`
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
  console.log('Last message role:', lastMessage?.role);

  const userQuery = extractTextFromMessage(lastMessage);

  if (lastMessage?.role !== 'user' || !userQuery) {
    console.log('userQuery vacío o role no es user. userQuery =', userQuery);
    return NextResponse.json({ error: 'No se recibió una pregunta válida.' }, { status: 400 });
  }

  try {
    // 1. DIAGNÓSTICO DEL SISTEMA PRIMERO
    const diagnostics = await diagnosticEmbeddings();
    if (!diagnostics.isLoaded || diagnostics.embeddingsCount === 0) {
      console.error('PROBLEMA CRÍTICO: Sistema de embeddings no disponible');
      
      const systemErrorReply = `SISTEMA NO DISPONIBLE

El sistema de búsqueda en el corpus no está funcionando correctamente.

**Estado del Sistema:**
- Embeddings cargados: ${diagnostics.isLoaded ? 'Sí' : 'No'}
- Total embeddings: ${diagnostics.embeddingsCount}
- Modelo: ${diagnostics.metadata?.model || 'Desconocido'}

**Por favor contacta al administrador del sistema.**`;

      const result = streamText({
        model: model,
        messages: convertToModelMessages(messages),
        system: `Responde EXACTAMENTE: "${systemErrorReply}"`,
      });

      return result.toUIMessageStreamResponse();
    }

    // 2. BÚSQUEDA CON FILTRO DE CALIDAD
    console.log('Buscando en corpus para:', userQuery);
    const { context: ragContext, topScore, resultsCount, qualityInfo } = await getLocalPDFRAGContextWithQuality(userQuery, {
      matchCount: 6,
      minSimilarity: 0.15,
      includeMetadata: true,
      requireHighQuality: true
    });
    
    console.log(`Resultados: ${resultsCount}, Top score: ${topScore.toFixed(3)}`);
    console.log(`Contexto length: ${ragContext?.length || 0}`);
    console.log(`Calidad: ${qualityInfo}`);
    
    // 3. SISTEMA GUÍA DEL CORPUS - EVALUACIÓN DE CONFIANZA Y RESPUESTA ESTRUCTURADA
    console.log('Aplicando protocolo Guía del Corpus...');
    
    // PASO A: Evaluación de Confianza según el prompt original
    if (topScore < 0.65 || !ragContext || ragContext.trim().length === 0 || resultsCount === 0) {
      console.log(`Confianza insuficiente. Top score: ${topScore.toFixed(3)}`);
      
      const lowConfidenceReply = `No encontré evidencia suficiente en el corpus con la confianza necesaria (score más alto: ${topScore.toFixed(2)}). ¿Deseas que busque una respuesta fuera de este corpus?`;

      const result = streamText({
        model: model,
        messages: convertToModelMessages(messages),
        system: `Responde EXACTAMENTE: "${lowConfidenceReply}"`,
      });

      return result.toUIMessageStreamResponse();
    }

    // PASO B: Construcción de Respuesta Estructurada según el prompt "Guía del Corpus"
    console.log('Construyendo respuesta estructurada...');
    
    // Preparar el prompt del sistema según el formato original
    const guiaCorpusPrompt = `Eres un asistente de conocimiento avanzado llamado "Guía del Corpus". Tu propósito es doble y unificado:

• Actúas como un Arquitecto de Conocimiento: Entiendes la mecánica de RAG y la búsqueda vectorial a nivel experto.
• Encarnas a un Guía Sabio y Compasivo: Tu comunicación es clara, empática y profunda.

Tu objetivo final es entregar respuestas precisas y éticas, basadas únicamente en la evidencia recuperada.

ESTRUCTURA OBLIGATORIA DE RESPUESTA:

1. Título Breve y Descriptivo
2. Respuesta Directa (1-2 frases)
3. Análisis Detallado (2-5 párrafos con referencias numeradas [1], [2], etc.)
4. Evidencias del Corpus (lista numerada con citas textuales)
5. Próximos pasos (sugerencias prácticas)

${topScore >= 0.65 && topScore < 0.75 ? 'NOTA: La confianza de esta respuesta es moderada. Se recomienda verificar las fuentes originales.' : ''}

REGLAS CRÍTICAS:
- Cada afirmación factual debe ir seguida de su referencia numerada [1], [2], etc.
- Las citas deben ser textuales y cortas (máximo 25 palabras)
- NUNCA incluyas información externa al corpus
- Mantén el tono de guía sabio, humilde y claro`;

    // Preparar el contexto de evidencia en formato estructurado
    const contextMessage = `### Contexto de Evidencia (Resultados del Retriever)

La siguiente es la ÚNICA información que debes usar para construir tu respuesta. Está ordenada por relevancia.

${ragContext}

### Pregunta a Responder

> ${userQuery}

### Tu Tarea

Actúa como "Guía del Corpus". Basándote estricta y exclusivamente en el "Contexto de Evidencia" proporcionado arriba, responde a la "Pregunta a Responder". Sigue al pie de la letra todas las reglas, el formato y la personalidad definidos en tu prompt de sistema.`;

    const result = streamText({
      model: model,
      messages: convertToModelMessages([
        ...messages.slice(0, -1), // Todos los mensajes anteriores
        { 
          role: 'user', 
          content: contextMessage 
        }
      ]),
      system: guiaCorpusPrompt,
      temperature: 0.2,
    });

    return result.toUIMessageStreamResponse();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error crítico en el endpoint:', errorMessage);

    const errorReply = `ERROR DEL SISTEMA

Se produjo un error técnico al procesar tu consulta.

**Error:** ${errorMessage.substring(0, 100)}...

**Por favor inténtalo de nuevo o contacta al administrador si el problema persiste.**`;

    const result = streamText({
      model: model,
      messages: convertToModelMessages(messages),
      system: `Responde EXACTAMENTE: "${errorReply}"`,
    });

    return result.toUIMessageStreamResponse();
  }
}