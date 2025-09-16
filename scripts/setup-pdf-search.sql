-- SETUP-PDF-SEARCH.SQL
-- Script para configurar la tabla de documentos PDF y búsqueda semántica
-- Este script NO afecta la tabla cv_data existente

-- 1. Extensión pgvector (asegúrate de que esté habilitada en Supabase)
create extension if not exists vector;

-- 2. Eliminar solo la tabla pdf_documents y su función si existen
drop table if exists pdf_documents;
drop function if exists search_pdf_documents;

-- 3. Crear la nueva tabla `pdf_documents`
create table pdf_documents (
  id bigserial primary key,
  file_name text not null,
  page_number int,
  chunk_index int not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now() not null
);

-- 4. Crear una función para la búsqueda semántica en pdf_documents
create function search_pdf_documents (
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
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
  where 1 - (pdf_documents.embedding <=> query_embedding) > match_threshold
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