# SETUP SQL MEJORADO PARA SUPABASE

```sql
-- Script MEJORADO para configurar la tabla de documentos PDF y búsqueda semántica
-- ✅ EJECUTAR ESTE CÓDIGO COMPLETO EN SUPABASE SQL EDITOR

-- 1. Extensión pgvector (asegúrate de que esté habilitada en Supabase)
create extension if not exists vector;

-- 2. Eliminar solo la tabla pdf_documents y su función si existen
drop table if exists pdf_documents;
drop function if exists search_pdf_documents;

-- 3. Crear la nueva tabla `pdf_documents` (sin cambios)
create table pdf_documents (
  id bigserial primary key,
  file_name text not null,
  page_number int,
  chunk_index int not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now() not null
);

-- 4. ✅ FUNCIÓN MEJORADA para la búsqueda semántica
create function search_pdf_documents (
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.4,  -- ✅ REDUCIDO de 0.7 a 0.4
  match_count int DEFAULT 6           -- ✅ AUMENTADO de 5 a 6
)
returns table (
  id bigint,
  file_name text,
  page_number int,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    pdf_documents.id,
    pdf_documents.file_name,
    pdf_documents.page_number,
    pdf_documents.content,
    1 - (pdf_documents.embedding <=> query_embedding) as similarity
  from pdf_documents
  where pdf_documents.embedding IS NOT NULL           -- ✅ AGREGADO: Verifica embeddings válidos
    and 1 - (pdf_documents.embedding <=> query_embedding) > match_threshold
  order by pdf_documents.embedding <=> query_embedding asc
  limit match_count;
end;
$$;

-- 5. Crear un índice para optimizar la búsqueda en pdf_documents
create index on pdf_documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- 6. Comentarios informativos
comment on table pdf_documents is 'Tabla para almacenar fragmentos de documentos PDF con sus embeddings';
comment on column pdf_documents.file_name is 'Nombre del archivo PDF original';
comment on column pdf_documents.page_number is 'Número de página dentro del PDF';
comment on column pdf_documents.chunk_index is 'Índice del fragmento dentro de la página';
comment on column pdf_documents.content is 'Contenido de texto del fragmento';
comment on column pdf_documents.embedding is 'Vector embedding generado por OpenAI';

-- 7. ✅ FUNCIÓN DE PRUEBA ADICIONAL (para debugging)
create function debug_pdf_documents_info ()
returns table (
  total_documents bigint,
  documents_with_embeddings bigint,
  avg_content_length float,
  sample_file_names text[]
)
language plpgsql
as $$
begin
  return query
  select
    count(*) as total_documents,
    count(embedding) as documents_with_embeddings,
    avg(length(content)) as avg_content_length,
    array(select distinct file_name from pdf_documents limit 5) as sample_file_names
  from pdf_documents;
end;
$$;
```

## 🎯 **MEJORAS QUE TRAE ESTE SQL:**

### ✅ **1. Threshold Más Permisivo (0.4 vs 0.7)**
- **Antes**: Solo matches con 70%+ de similitud
- **Ahora**: Matches con 40%+ de similitud
- **Resultado**: Más resultados, especialmente para consultas complejas

### ✅ **2. Más Resultados (6 vs 5)**
- **Antes**: Máximo 5 chunks por consulta
- **Ahora**: Máximo 6 chunks por consulta  
- **Resultado**: Tu prompt tiene más evidencia para generar respuestas

### ✅ **3. Verificación de Embeddings NULL**
- **Antes**: Podía intentar buscar en documentos sin embeddings
- **Ahora**: Solo busca en documentos con embeddings válidos
- **Resultado**: Evita errores y mejora rendimiento

### ✅ **4. Función de Debug Incluida**
- Permite diagnosticar problemas fácilmente
- Uso: `SELECT * FROM debug_pdf_documents_info();`

## 📋 **PASOS PARA APLICAR:**

### 1. **Ejecutar SQL en Supabase**
- Ve a tu proyecto Supabase
- Abre el **SQL Editor**
- Pega todo el código SQL de arriba
- Haz clic en **Run**

### 2. **Reemplazar pdf-embeddings.ts**
- Usa el archivo corregido que generé
- Reemplaza tu archivo actual

### 3. **Probar el Sistema**
- Haz consultas como: "¿Qué dice sobre bombas nucleares?"
- Revisa los logs de la consola
- Las citas ahora deberían mostrar archivo y página real

## ⚡ **RESULTADO ESPERADO:**

```
Evidencias del Corpus:
1. "Bombas nucleares no funcionan como se les dice allí..." [Fuente: bombas-nucleares-bombas-de-energia-yazhi-swaruu-sophia.pdf, Página 1]
2. "Es agenda de miedo. Aún Hiroshima y Nagasaki..." [Fuente: bombas-nucleares-bombas-de-energia-yazhi-swaruu-sophia.pdf, Página 1]
```

¡Con estos cambios tu sistema RAG debería funcionar perfectamente!