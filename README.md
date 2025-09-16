# Chatbot RAG con Next.js, OpenAI y Supabase

Este proyecto es un chatbot inteligente construido con Next.js que utiliza un modelo RAG (Retrieval-Augmented Generation) para responder preguntas sobre un currículum (CV). El chatbot aprovecha los embeddings de OpenAI para realizar búsquedas semánticas en una base de datos vectorial de Supabase (PostgreSQL con pgvector).

## Características Principales

- **Arquitectura RAG:** Enriquece las respuestas del modelo de lenguaje con información relevante extraída de una base de datos de conocimiento (el CV).
- **Búsqueda Semántica:** Utiliza embeddings de texto (`text-embedding-3-small` de OpenAI) para encontrar la información más relevante a la pregunta del usuario, en lugar de depender de palabras clave.
- **Base de Datos Vectorial:** Almacena los embeddings en Supabase y utiliza la extensión `pgvector` para realizar búsquedas de similitud de coseno de manera eficiente.
- **API Propia:** Expone un endpoint (`/api/chat`) que puede ser consumido por cualquier frontend, como un portafolio personal.
- **Interfaz de Chat:** Incluye una interfaz de usuario simple para probar el chatbot directamente.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (React)
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
- **IA y Embeddings:** [OpenAI API](https://openai.com/)
- **Base de Datos:** [Supabase](https://supabase.com/) (PostgreSQL con extensión `pgvector`)
- **Despliegue:** [Vercel](https://vercel.com/)

---

## Configuración y Puesta en Marcha

Sigue estos pasos para configurar y ejecutar el proyecto en un entorno de desarrollo local.

### 1. Prerrequisitos

- [Node.js](https://nodejs.org/) (versión 18 o superior)
- Una cuenta de [OpenAI](https://platform.openai.com/) con una clave de API.
- Una cuenta de [Supabase](https://supabase.com/) con un proyecto creado.

### 2. Clonar el Repositorio

```bash
git clone <URL-del-repositorio>
cd <nombre-del-directorio>
```

### 3. Instalar Dependencias

```bash
npm install
```

### 4. Configurar la Base de Datos en Supabase

1.  Ve a tu proyecto de Supabase y abre el **SQL Editor**.
2.  Ejecuta el contenido del archivo `scripts/setup-cv-search.sql`. Esto creará la tabla `cv_data` y la función `search_cv_data` necesaria para la búsqueda semántica.

### 5. Configurar las Variables de Entorno

Crea un archivo llamado `.env.local` en la raíz del proyecto y añade las siguientes variables con tus propias claves:

```env
# Clave de API de OpenAI
OPENAI_API_KEY="sk-..."

# URL y Clave de Servicio de Supabase
SUPABASE_URL="https://<tu-id-de-proyecto>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="tu-clave-de-servicio"
```

> **Nota:** La `SERVICE_ROLE_KEY` es necesaria para realizar operaciones en el backend, como la generación de embeddings, saltándose las políticas de RLS.

### 6. Generar los Embeddings

El proyecto incluye un script para leer los datos del CV, generar los embeddings y guardarlos en Supabase. Ejecútalo con el siguiente comando:

```bash
npx tsx scripts/populate-embeddings.ts
```

Deberías ver en la consola la confirmación de que los registros han sido creados.

### 7. Ejecutar el Servidor de Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador para interactuar con el chatbot.

## Despliegue en Vercel

La forma más sencilla de desplegar este proyecto es usando [Vercel](https://vercel.com/).

1.  Sube tu repositorio a GitHub.
2.  Importa el repositorio en Vercel.
3.  En la configuración del proyecto en Vercel, **añade las mismas variables de entorno** que definiste en tu archivo `.env.local`.
4.  Vercel se encargará del resto. Una vez finalizado, tendrás una URL pública para tu chatbot.

## Uso de la API

Una vez desplegado, puedes integrar el chatbot en cualquier otra aplicación (como tu portafolio) haciendo una petición POST al endpoint `/api/chat`.

- **URL:** `https://<tu-app>.vercel.app/api/chat`
- **Método:** `POST`
- **Body (JSON):**
  ```json
  {
    "messages": [
      { "role": "user", "parts": [{ "type": "text", "text": "¿Cuál es tu experiencia con Next.js?" }] }
    ]
  }
  ```
