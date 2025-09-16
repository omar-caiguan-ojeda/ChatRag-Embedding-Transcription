import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { config } from 'dotenv'

// Cargar variables de entorno
config()

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const openaiKey = process.env.OPENAI_API_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)
const openai = new OpenAI({ apiKey: openaiKey })

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' '),
  })
  
  return response.data[0].embedding
}

async function populateEmbeddings() {
  try {
    console.log('🚀 Iniciando generación de embeddings...')
    
    // 1. Obtener todos los registros
    const { data: records, error: fetchError } = await supabase
      .from('cv_data')
      .select('*')
    
    if (fetchError) {
      throw fetchError
    }
    
    if (!records || records.length === 0) {
      console.log('✅ Todos los registros ya tienen embeddings')
      return
    }
    
    console.log(`📝 Procesando ${records.length} registros...`)
    
    // 2. Generar embeddings para cada registro
    for (let i = 0; i < records.length; i++) {
      const record = records[i]
      console.log(`⏳ Procesando ${i + 1}/${records.length}: ${record.title}`)
      
      // Combinar título y contenido para el embedding
      const textForEmbedding = `${record.title}\n${record.content}`
      
      try {
        // Generar embedding
        const embedding = await generateEmbedding(textForEmbedding)
        
        // Actualizar registro con embedding
        const { error: updateError } = await supabase
          .from('cv_data')
          .update({ embedding: embedding }) 
          .eq('id', record.id)
        
        if (updateError) {
          console.error(`❌ Error actualizando registro ${record.id}:`, updateError)
          continue
        }
        
        console.log(`✅ Completado: ${record.title}`)
        
        // Pequeña pausa para evitar rate limits
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`❌ Error generando embedding para ${record.title}:`, error)
      }
    }
    
    console.log('🎉 ¡Proceso completado!')
    
  } catch (error) {
    console.error('💥 Error en el proceso:', error)
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  populateEmbeddings()
}
