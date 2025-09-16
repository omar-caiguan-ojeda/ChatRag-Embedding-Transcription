import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import fs from 'fs/promises'
import path from 'path'
import pdf from 'pdf-parse'
import OpenAI from 'openai'

// Cargar variables de entorno desde .env.local
config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const openaiKey = process.env.OPENAI_API_KEY!

if (!supabaseUrl || !supabaseKey || !openaiKey) {
  throw new Error(
    'Asegúrate de que SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y OPENAI_API_KEY están en tu archivo .env.local'
  )
}

const supabase = createClient(supabaseUrl, supabaseKey)
const openai = new OpenAI({ apiKey: openaiKey })

const DATA_DIR = path.join(__dirname, '../data')
const CHUNK_SIZE = 1500 // Caracteres por chunk
const CHUNK_OVERLAP = 200 // Superposición para no perder contexto

// ✅ MEJORA 1: Mejor limpieza de texto
function cleanText(text: string): string {
  return text
    .replace(/\n+/g, ' ')           // Múltiples saltos de línea → espacio
    .replace(/\s+/g, ' ')           // Múltiples espacios → un espacio
    .replace(/[^\w\s\-.,!?¿¡áéíóúüñÁÉÍÓÚÜÑ]/g, ' ') // Mantener caracteres útiles
    .trim()
}

// ✅ MEJORA 2: Validación de embeddings
async function generateEmbedding(text: string): Promise<number[] | null> {
  const cleanedText = cleanText(text)
  
  if (!cleanedText.trim() || cleanedText.length < 10) {
    console.log('    - Texto muy corto o vacío, saltando...')
    return null
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: cleanedText,
    })

    const embedding = response.data[0].embedding
    
    // ✅ Verificar dimensiones
    if (embedding.length !== 1536) {
      console.error(`    ❌ Embedding incorrecto: ${embedding.length} dimensiones (esperadas: 1536)`)
      return null
    }

    return embedding
  } catch (error) {
    console.error('    ❌ Error generando embedding:', error)
    return null
  }
}

// ✅ MEJORA 3: Verificar duplicados
async function fileAlreadyProcessed(fileName: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('pdf_documents')
    .select('file_name')
    .eq('file_name', fileName)
    .limit(1)
  
  if (error) {
    console.error('❌ Error verificando duplicados:', error.message)
    return false
  }
  
  return data && data.length > 0
}

async function processPDFs() {
  try {
    console.log('🚀 Iniciando procesamiento de PDFs...')
    
    // ✅ MEJORA 4: Verificar estado de la tabla
    const { data: testData, error: testError } = await supabase
      .from('pdf_documents')
      .select('count', { count: 'exact' })
    
    if (testError) {
      console.error('❌ Error conectando con la base de datos:', testError.message)
      return
    }
    
    console.log(`📊 Documentos existentes en BD: ${testData[0]?.count || 0}`)
    
    const files = await fs.readdir(DATA_DIR)
    const pdfFiles = files.filter((file) => path.extname(file).toLowerCase() === '.pdf')

    if (pdfFiles.length === 0) {
      console.log('🤷 No se encontraron archivos PDF en el directorio `data`.')
      return
    }

    console.log(`📄 Encontrados ${pdfFiles.length} archivos PDF para procesar.`)

    for (const pdfFile of pdfFiles) {
      console.log(`\n--- Procesando: ${pdfFile} ---`)
      
      // ✅ MEJORA 5: Verificar si ya fue procesado
      if (await fileAlreadyProcessed(pdfFile)) {
        console.log(`⚠️  ${pdfFile} ya fue procesado anteriormente. Saltando...`)
        console.log(`   (Si quieres reprocesarlo, elimínalo de la BD primero)`)
        continue
      }
      
      const filePath = path.join(DATA_DIR, pdfFile)
      const fileBuffer = await fs.readFile(filePath)

      // 1. Obtener el número total de páginas
      const pdfInfo = await pdf(fileBuffer, { max: 0 })
      const numPages = pdfInfo.numpages
      console.log(`📄 Total de páginas: ${numPages}`)

      let totalChunks = 0
      let processedChunks = 0

      // 2. Procesar cada página individualmente
      for (let p = 1; p <= numPages; p++) {
        const pageData = await pdf(fileBuffer, { min: p, max: p } as any)
        const text = pageData.text

        if (!text || text.trim().length < 50) {
          console.log(`- Página ${p} de ${pdfFile} no contiene suficiente texto.`)
          continue
        }

        // Dividir el texto de la página en chunks
        const chunks: string[] = []
        for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
          chunks.push(text.substring(i, i + CHUNK_SIZE))
        }

        console.log(`  📄 Página ${p}: Dividida en ${chunks.length} chunks.`)
        totalChunks += chunks.length

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i]
          const logTitle = `Página ${p}, Chunk ${i + 1}`
          console.log(`    ⏳ Generando embedding para: "${logTitle}"`)

          const embedding = await generateEmbedding(chunk)
          if (!embedding) {
            console.log(`    - Saltando chunk inválido.`)
            continue
          }

          const { error } = await supabase.from('pdf_documents').insert({
            file_name: pdfFile,
            page_number: p,
            chunk_index: i,
            content: cleanText(chunk),
            embedding: embedding,
          })

          if (error) {
            console.error(`    ❌ Error guardando en Supabase para "${logTitle}":`, error.message)
          } else {
            processedChunks++
            console.log(`    ✅ Guardado: "${logTitle}" (${processedChunks}/${totalChunks})`)
          }

          // Pausa para no saturar la API de OpenAI
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }
      
      console.log(`📊 ${pdfFile}: ${processedChunks} chunks procesados exitosamente.`)
    }

    // // ✅ MEJORA 6: Resumen final
    // const { data: finalCount } = await supabase
    //   .from('pdf_documents')
    //   .select('count', { count: 'exact' })
    
    // console.log(`\n🎉 ¡Proceso completado!`)
    // console.log(`📊 Total de documentos en BD: ${finalCount[0]?.count || 0}`)

    // ✅ MEJORA 6: Resumen final
    const { data: finalCount } = await supabase
      .from('pdf_documents')
      .select('count', { count: 'exact' })

    console.log(`\n🎉 ¡Proceso completado!`)

    if (finalCount === null) {
      console.log('📊 No se pudo obtener el total de documentos en BD.')
    } else {
      console.log(`📊 Total de documentos en BD: ${finalCount[0]?.count || 0}`)
    }
    
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.error('💥 Error: El directorio `data` no existe. Por favor, créalo en la raíz del proyecto.')
    } else {
      console.error('💥 Error en el proceso:', error)
    }
  }
}

processPDFs()
