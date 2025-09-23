@echo off
echo 🗜️ Generando Embeddings Comprimidos para GitHub + Vercel
echo ========================================================
echo.

REM Verificar que existe el directorio de PDFs
if not exist "corpus-pdfs" (
    echo ❌ Error: No se encuentra el directorio 'corpus-pdfs'
    echo ✅ Crea el directorio y coloca tus archivos PDF allí
    pause
    exit /b 1
)

REM Contar archivos PDF
set PDF_COUNT=0
for %%f in (corpus-pdfs\*.pdf) do set /a PDF_COUNT+=1

if %PDF_COUNT% equ 0 (
    echo ❌ Error: No se encontraron archivos PDF en corpus-pdfs/
    echo ✅ Coloca tus archivos PDF en el directorio corpus-pdfs/
    pause
    exit /b 1
)

echo 📄 Encontrados %PDF_COUNT% archivos PDF
echo 🚀 Iniciando generación de embeddings comprimidos...
echo.

REM Ejecutar el script de generación
call npx tsx scripts/generate-compressed-embeddings.ts

REM Verificar que se generaron los archivos
if exist "app/embeddings-compressed.json.gz" (
    echo.
    echo ✅ ¡Generación completada exitosamente!
    echo 📊 Resumen:
    for %%f in ("app/embeddings-compressed.json") do echo    - Versión sin comprimir: %%~zf bytes
    for %%f in ("app/embeddings-compressed.json.gz") do echo    - Versión comprimida: %%~zf bytes
    echo.
    echo 🚀 Siguientes pasos:
    echo    1. git add .
    echo    2. git commit -m "Add compressed embeddings for production"
    echo    3. git push
    echo    4. Vercel hará deploy automáticamente
    echo.
    echo 🎉 ¡Listo para GitHub y Vercel!
    pause
) else (
    echo ❌ Error: No se pudo generar el archivo comprimido
    pause
    exit /b 1
)
