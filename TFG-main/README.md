
# TFG: Plataforma de Autoevaluación para Bases de Datos con IA 🧠

**Trabajo Fin de Grado — Miguel Sánchez-Beato**

---

## Descripción

Esta aplicación web ayuda a estudiantes de “Sistemas de Bases de Datos” a autoevaluarse mediante un modelo de lenguaje grande (LLM, Llama 3). Los estudiantes pueden practicar, recibir feedback inmediato y hacer seguimiento de su progreso de forma intuitiva.

---

## Índice

1. [Características principales](#características-principales)  
2. [Guía de instalación y puesta en marcha](#guía-de-instalación-y-puesta-en-marcha)  
    1. [Requisitos previos](#1-requisitos-previos)  
    2. [Clonar el repositorio](#2-clonar-el-repositorio)  
    3. [Configurar la base de datos](#3-configurar-la-base-de-datos)  
    4. [Instalar dependencias](#4-instalar-dependencias)  
    5. [Ejecutar el modelo LLM (Llama 3) con Docker](#5-ejecutar-el-modelo-llm-llama-3-con-docker)  
    6. [Iniciar el backend](#6-iniciar-el-backend)  
    7. [Iniciar el frontend](#7-iniciar-el-frontend)  
3. [Manual de usuario](#manual-de-usuario)

---

## Características principales

- **Dashboard de Progreso**  
  Visualiza tu avance general, el progreso por objetivos de aprendizaje y el total de preguntas respondidas, pendientes y falladas.

- **Evaluación por Objetivos**  
  La aplicación se estructura en torno a los objetivos de aprendizaje de la asignatura.

- **Generación de Preguntas a Demanda**  
  Solicita nuevas preguntas para criterios de aceptación específicos y el modelo las generará para ti.

- **Feedback Instantáneo**  
  Recibe al momento si tu respuesta es correcta (🟢) o incorrecta (🔴), junto con una explicación detallada.

- **Historial de Intentos**  
  Guarda todos tus intentos, permitiendo reintentar preguntas falladas y seguir tu evolución.

- **Notificaciones Intuitivas**  
  El sistema informa sobre el estado de las operaciones (éxito, en proceso, error) mediante un código de colores.

---

## Guía de instalación y puesta en marcha

### 1. Requisitos previos

- **Docker Desktop** (v20.10 o superior)
- **Node.js** (v18.0 o superior)
- **npm** (incluido con Node.js)
- **Mínimo 8 GB de RAM**
- **Procesador Intel i7 de 7ª generación o similar**
- **Conexión a Internet**

---

### 2. Clonar el repositorio

```bash
git clone https://github.com/Miguelsbdh/TFG.git
cd TFG
```

**Estructura del proyecto:**

```
cliente/
servidor/
README.md
tfg.sql
```

---

### 3. Configurar la base de datos 🗄️

Se recomienda usar **XAMPP** para gestionar la base de datos MySQL.

1. Inicia los módulos de Apache y MySQL en XAMPP.
2. Accede a phpMyAdmin y ejecuta la siguiente consulta SQL para crear el usuario y darle permisos:

    ```sql
    -- Crea el usuario para conexiones locales y desde Docker
    CREATE USER 'tfg'@'localhost' IDENTIFIED BY 'tfg';
    CREATE USER 'tfg'@'%' IDENTIFIED BY 'tfg';
    GRANT ALL PRIVILEGES ON tfg.* TO 'tfg'@'localhost';
    GRANT ALL PRIVILEGES ON tfg.* TO 'tfg'@'%';
    FLUSH PRIVILEGES;
    ```

3. Crea la base de datos:

    ```sql
    CREATE DATABASE tfg;
    ```

4. Selecciona la base de datos `tfg` y usa la función de importación para cargar el archivo **tfg.sql** (en la raíz del proyecto).

---

### 4. Instalar dependencias

Abre dos terminales en la raíz del proyecto (una para el backend y otra para el frontend):

**Backend:**
```bash
cd servidor
npm install
```

**Frontend:**
```bash
cd cliente
npm install
```

---

### 5. Ejecutar el modelo LLM (Llama 3) con Docker 🐳

1. Descarga el modelo `llama-3-finetuned-bases-de-datos-unsloth.Q5_K_M.gguf` desde Hugging Face en https://huggingface.co/Miguelsbdh/llama-3-finetuned-bases-de-datos/tree/main.
2. Guarda el archivo en una carpeta, por ejemplo: `C:/llama.cpp/models`.
3. Ejecuta el siguiente comando (ajusta la ruta en `-v` según corresponda):

    ```bash
    docker run --rm -it -p 8000:8000 \
      -v /c/llama.cpp/models:/models \
      -e MODEL=/models/llama-3-finetuned-bases-de-datos-unsloth.Q5_K_M.gguf \
      ghcr.io/abetlen/llama-cpp-python:v0.3.1
    ```

**Nota:** Modifica la ruta `/c/llama.cpp/models` para que apunte a la carpeta donde guardaste el modelo `.gguf`.

---

### 6. Iniciar el backend

En la terminal del backend (`/servidor`):

```bash
npm start
```

El servidor quedará escuchando en el puerto **9001**.

---

### 7. Iniciar el frontend

En la terminal del frontend (`/cliente`):

```bash
npm run dev
```

La aplicación se abrirá automáticamente en tu navegador en [http://localhost:9000](http://localhost:9000).

---

## Manual de usuario

1. **Inicio:**  
   Accede a [http://localhost:9000](http://localhost:9000). Verás un dashboard con tu progreso.

2. **Selecciona un objetivo:**  
   Navega a una de las páginas de objetivos de aprendizaje.

3. **Explora historias de usuario:**  
   Despliega una historia para ver sus criterios de aceptación y el número de preguntas disponibles.

4. **Genera preguntas (opcional):**  
   Si quieres más preguntas, selecciona los criterios y pulsa "Solicitar más preguntas".  
   *La generación tarda unos 2.5 minutos por criterio. Una notificación azul 🔵 te informará del proceso.*

5. **Evalúate:**  
   Pulsa "Evaluar historia" para comenzar un test.

6. **Responde y aprende:**  
   Selecciona tu respuesta y recibe feedback instantáneo.

7. **Revisa tus resultados:**  
   Al final del test, verás un resumen de tu desempeño.

---
