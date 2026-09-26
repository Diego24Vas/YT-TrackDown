# 🎵🎬 YT-TrackDown

**YT-TrackDown** es una aplicación web rápida, moderna y ligera para descargar **audio (MP3)** de alta fidelidad y **video (MP4)** en diversas resoluciones directamente desde enlaces de YouTube.

Permite procesar enlaces individuales o listas completas por lotes en segundo plano, con actualización de progreso en tiempo real y sin necesidad de instalar clientes pesados en tu equipo.

---

## ✨ Características Principales

- 📥 **Descargas individuales y por lotes (Batch)**: Pega uno o varios enlaces de YouTube (uno por línea o separados por espacios) para procesarlos juntos.
- 🎵 **Modo Audio (MP3)**: Elige la tasa de bits deseada (**128 kbps**, **192 kbps**, **256 kbps** o **320 kbps**).
- 🎬 **Modo Video (MP4)**: Descarga videos combinados con audio en resoluciones de alta definición (**1080p Full HD**, **720p HD**, **480p**, **360p** o **Máxima calidad original**).
- ⚡ **Progreso en tiempo real**: Monitorea el estado, porcentaje y velocidad de cada descarga mediante *Server-Sent Events (SSE)*.
- 🔄 **Cola asíncrona no bloqueante**: Trabaja con un pool de descargas concurrentes en segundo plano; la interfaz nunca se congela.
- 🧹 **Limpieza automática de almacenamiento**: Los archivos generados se eliminan automáticamente tras un período configurable (por defecto 15 minutos) para evitar saturar el disco.
- 🎨 **Interfaz limpia y responsiva**: Diseñada con HTML5, CSS moderno y JavaScript puro (Vanilla JS), optimizada para pantallas móviles y de escritorio.
- 🐳 **Lista para Docker**: Despliegue inmediato en un solo comando con contenedor optimizado y FFmpeg preinstalado.

---

## 🚀 Inicio Rápido

### Opción 1: Con Docker Compose (Recomendado)

La forma más sencilla de ejecutar la aplicación con todas sus dependencias (incluyendo Python y FFmpeg):

```bash
# Iniciar el contenedor
docker compose up -d
```

Una vez levantado, abre tu navegador en:
👉 **[http://localhost:8080](http://localhost:8080)**

Para detener la aplicación:
```bash
docker compose down
```

---

### Opción 2: Ejecución Local

**Requisitos previos:**
- Python 3.10 o superior
- [FFmpeg](https://ffmpeg.org/) instalado y accesible en tu `PATH`

1. **Instalar dependencias:**
   ```bash
   pip install -r backend/requirements.txt
   ```

2. **Iniciar el servidor:**
   ```bash
   python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8080 --reload
   ```

3. **Abrir en el navegador:**
   Accede a [http://localhost:8080](http://localhost:8080).

---

## 🛠️ Tecnologías

- **Backend**: [FastAPI](https://fastapi.tiangolo.com/), [yt-dlp](https://github.com/yt-dlp/yt-dlp), [FFmpeg](https://ffmpeg.org/), Uvicorn, SSE-Starlette.
- **Frontend**: HTML5 semántico, CSS3 modular (con variables y diseño responsivo), JavaScript ES6+ (Vanilla JS).
- **Despliegue**: Docker & Docker Compose.

---

## ⚙️ Variables de Entorno

Puedes personalizar la configuración mediante variables en el entorno o en `docker-compose.yml`:

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `PORT` | Puerto de escucha del servidor web | `8080` |
| `MAX_CONCURRENT_DOWNLOADS` | Límite de descargas simultáneas en paralelo | `2` |
| `DEFAULT_FORMAT` | Formato por defecto (`mp3` o `mp4`) | `mp3` |
| `DEFAULT_AUDIO_QUALITY` | Calidad por defecto del audio en kbps (`128`, `192`, `256`, `320`) | `192` |
| `DEFAULT_VIDEO_QUALITY` | Resolución por defecto del video (`360`, `480`, `720`, `1080`, `best`) | `1080` |
| `FILE_RETENTION_MINUTES` | Minutos antes de eliminar automáticamente los archivos descargados | `15` |

---

## 📄 Licencia

Este proyecto está bajo la licencia [GNU General Public License v3.0](LICENSE).