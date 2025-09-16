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

async function generateEmbedding(text: string): Promise<number[]> {
  const cleanText = text.replace(/\n/g, ' ')
  if (!cleanText.trim()) {
    // OpenAI arroja error si el input está vacío
    return []
  }

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: cleanText,
  })

  return response.data[0].embedding
}

async function processPDFs() {
  try {
    console.log('🚀 Iniciando procesamiento de PDFs...')
    const files = await fs.readdir(DATA_DIR)
    const pdfFiles = files.filter((file) => path.extname(file).toLowerCase() === '.pdf')

    if (pdfFiles.length === 0) {
      console.log('🤷 No se encontraron archivos PDF en el directorio `data`.')
      return
    }

    console.log(`📄 Encontrados ${pdfFiles.length} archivos PDF para procesar.`)

    for (const pdfFile of pdfFiles) {
      console.log(`
--- Procesando: ${pdfFile} ---
`)
      const filePath = path.join(DATA_DIR, pdfFile)
      const fileBuffer = await fs.readFile(filePath)

      // 1. Obtener el número total de páginas
      const pdfInfo = await pdf(fileBuffer, { max: 0 })
      const numPages = pdfInfo.numpages

      // 2. Procesar cada página individualmente
      for (let p = 1; p <= numPages; p++) {
        const pageData = await pdf(fileBuffer, { min: p, max: p } as any) // 'as any' para evitar error de tipos
        const text = pageData.text

        if (!text) {
          console.log(`- Página ${p} de ${pdfFile} no contiene texto extraíble.`)
          continue
        }

        // Dividir el texto de la página en chunks
        const chunks: string[] = []
        for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
          chunks.push(text.substring(i, i + CHUNK_SIZE))
        }

        console.log(`  📄 Página ${p}: Dividida en ${chunks.length} chunks.`)

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i]
          const logTitle = `Página ${p}, Chunk ${i + 1}`
          console.log(`    ⏳ Generando embedding para: "${logTitle}"`)

          try {
            const embedding = await generateEmbedding(chunk)
            if (embedding.length === 0) {
              console.log(`    - Ignorando chunk vacío o sin contenido.`)
              continue
            }

            const { error } = await supabase.from('pdf_documents').insert({
              file_name: pdfFile,
              page_number: p,
              chunk_index: i,
              content: chunk,
              embedding: embedding,
            })

            if (error) {
              console.error(`    ❌ Error guardando en Supabase para "${logTitle}":`, error.message)
            } else {
              console.log(`    ✅ Guardado: "${logTitle}"`)
            }

            // Pausa para no saturar la API de OpenAI
            await new Promise((resolve) => setTimeout(resolve, 200))
          } catch (e) {
            console.error(`    ❌ Error generando embedding para "${logTitle}":`, e)
          }
        }
      }
    }

    console.log('\n🎉 ¡Proceso completado!')
  } catch (error: any) {
    if (error.code === 'ENOENT') {
        console.error('💥 Error: El directorio `data` no existe. Por favor, créalo en la raíz del proyecto.')
    } else {
        console.error('💥 Error en el proceso:', error)
    }
  }
}

processPDFs()
