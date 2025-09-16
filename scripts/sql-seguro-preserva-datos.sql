# SQL SEGURO - PRESERVA DATOS EXISTENTES

```sql
-- ✅ VERSIÓN SEGURA: Solo actualiza la función, PRESERVA todos los datos
-- ✅ EJECUTAR ESTE CÓDIGO EN SUPABASE SIN PERDER DATOS

-- 1. Extensión pgvector (asegúrate de que esté habilitada)
create extension if not exists vector;

-- 2. ✅ SOLO eliminar y reemplazar la FUNCIÓN (no la tabla)
drop function if exists search_pdf_documents;

-- 3. ✅ FUNCIÓN MEJORADA para la búsqueda semántica
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

-- 4. ✅ CREAR ÍNDICE solo si no existe (evita errores si ya existe)
do $$
begin
  if not exists (
    select 1 from pg_indexes 
    where tablename = 'pdf_documents' 
    and indexname like '%embedding%'
  ) then
    create index on pdf_documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);
  end if;
end $$;

-- 5. ✅ FUNCIÓN DE DEBUG (para verificar tus datos)
create or replace function debug_pdf_documents_info ()
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

-- 6. ✅ VERIFICAR TUS DATOS después de ejecutar
-- Ejecuta esto para confirmar que tus datos siguen ahí:
-- SELECT * FROM debug_pdf_documents_info();
```

## 🔍 **DIFERENCIAS CLAVE: CREATE vs CREATE OR REPLACE**

### ❌ **CREATE** (versión original)
- Falla si la función ya existe
- Error: "function already exists"
- Menos flexible

### ✅ **CREATE OR REPLACE** (versión mejorada)  
- Reemplaza la función si existe
- Crea la función si no existe
- Más seguro para updates

## 📊 **QUE HACE ESTA VERSIÓN SEGURA:**

### ✅ **PRESERVA TUS DATOS**
- **NO** elimina la tabla `pdf_documents`
- **NO** borra tus embeddings existentes
- **NO** afecta el contenido cargado

### ✅ **SOLO ACTUALIZA LA FUNCIONALIDAD**
- Cambia threshold de 0.7 → 0.4 
- Aumenta resultados de 5 → 6
- Agrega verificación `IS NOT NULL`
- Mejora el índice (sin duplicar)

### ✅ **FUNCIÓN DEBUG INCLUIDA**
Después de ejecutar, puedes verificar tus datos:
```sql
SELECT * FROM debug_pdf_documents_info();
```

Esto te mostrará:
- Cuántos documentos tienes
- Cuántos tienen embeddings
- Longitud promedio del contenido  
- Nombres de archivos de muestra

## 🎯 **PASOS SEGUROS:**

1. **Ejecuta el SQL seguro** (archivo que acabo de crear)
2. **Verifica tus datos** con `SELECT * FROM debug_pdf_documents_info();`
3. **Actualiza tu pdf-embeddings.ts** con la versión corregida
4. **Prueba consultas** - deberían funcionar mejor

## ⚡ **RESULTADO ESPERADO:**
- ✅ Todos tus datos PDF preservados
- ✅ Función mejorada (más permisiva)  
- ✅ Mejor rendimiento de búsqueda
- ✅ Citas correctas en las respuestas

¡Gracias por preguntar antes de ejecutar! Eso evitó que perdieras todos tus embeddings. 🙌