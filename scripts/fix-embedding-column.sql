-- Paso 1: Vaciar la columna de embeddings para liberar memoria.
-- Esto elimina los datos incorrectos y prepara la columna para el cambio de tipo.
UPDATE public.cv_data
SET embedding = NULL;

-- Paso 2: Cambiar el tipo de la columna a vector.
-- Como la columna está vacía, esta operación debería ser instantánea y no consumir memoria.
ALTER TABLE public.cv_data
ALTER COLUMN embedding TYPE vector(1536);

-- Verificar que el cambio se aplicó (opcional, puedes ejecutar esto en Supabase para confirmar)
-- SELECT column_name, data_type 
-- FROM information_schema.columns
-- WHERE table_name = 'cv_data' AND column_name = 'embedding';
