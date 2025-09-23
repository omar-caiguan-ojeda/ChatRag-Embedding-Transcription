#!/bin/bash

echo "🗜️ Generando Embeddings Comprimidos para GitHub + Vercel"
echo "========================================================"

# Verificar que existe el directorio de PDFs
if [ ! -d "corpus-pdfs" ]; then
    echo "❌ Error: No se encuentra el directorio 'corpus-pdfs'"
    echo "✅ Crea el directorio y coloca tus archivos PDF allí"
    exit 1
fi

# Contar archivos PDF
PDF_COUNT=$(ls corpus-pdfs/*.pdf 2>/dev/null | wc -l)
if [ $PDF_COUNT -eq 0 ]; then
    echo "❌ Error: No se encontraron archivos PDF en corpus-pdfs/"
    echo "✅ Coloca tus archivos PDF en el directorio corpus-pdfs/"
    exit 1
fi

echo "📄 Encontrados $PDF_COUNT archivos PDF"
echo "🚀 Iniciando generación de embeddings comprimidos..."

# Ejecutar el script de generación
npx tsx scripts/generate-compressed-embeddings.ts

# Verificar que se generaron los archivos
if [ -f "app/embeddings-compressed.json.gz" ]; then
    ORIGINAL_SIZE=$(ls -lh app/embeddings-compressed.json | awk '{print $5}' 2>/dev/null || echo "N/A")
    COMPRESSED_SIZE=$(ls -lh app/embeddings-compressed.json.gz | awk '{print $5}')

    echo ""
    echo "✅ ¡Generación completada exitosamente!"
    echo "📊 Resumen:"
    echo "   - Archivos procesados: $PDF_COUNT"
    echo "   - Versión sin comprimir: $ORIGINAL_SIZE"
    echo "   - Versión comprimida: $COMPRESSED_SIZE"
    echo ""
    echo "🚀 Siguientes pasos:"
    echo "   1. git add ."
    echo "   2. git commit -m 'Add compressed embeddings for production'"
    echo "   3. git push"
    echo "   4. Vercel hará deploy automáticamente"
    echo ""
    echo "🎉 ¡Listo para GitHub y Vercel!"
else
    echo "❌ Error: No se pudo generar el archivo comprimido"
    exit 1
fi
