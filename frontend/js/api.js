/**
 * API client and Server-Sent Events (SSE) stream manager
 */
export const api = {
  baseUrl: window.location.origin,

  async getPreview(urls) {
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Error al inspeccionar enlaces" }));
      throw new Error(err.detail || "Error en la petición");
    }
    return res.json();
  },

  async addDownloads(urls, quality = "192") {
    const res = await fetch("/api/downloads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls, quality }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Error al enviar los enlaces" }));
      throw new Error(err.detail || "Error en la petición");
    }
    return res.json();
  },

  async listDownloads() {
    const res = await fetch("/api/downloads");
    if (!res.ok) throw new Error("Error al obtener la lista de descargas");
    return res.json();
  },

  async retryDownload(id) {
    const res = await fetch(`/api/downloads/${id}/retry`, { method: "POST" });
    if (!res.ok) throw new Error("Error al reintentar descarga");
    return res.json();
  },

  async deleteDownload(id) {
    const res = await fetch(`/api/downloads/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Error al eliminar descarga");
    return res.json();
  },

  async clearCompleted() {
    const res = await fetch("/api/downloads/clear-completed", { method: "POST" });
    if (!res.ok) throw new Error("Error al limpiar completados");
    return res.json();
  },

  getFileUrl(id) {
    return `/api/downloads/${id}/file`;
  },

  getZipUrl() {
    return `/api/downloads/export/zip`;
  },

  /**
   * Connects to Server-Sent Events stream for non-blocking live progress
   */
  connectEvents(onEvent, onStatusChange) {
    let eventSource = null;
    let reconnectTimeout = null;

    const connect = () => {
      if (eventSource) {
        eventSource.close();
      }

      eventSource = new EventSource("/api/events");

      eventSource.onopen = () => {
        if (onStatusChange) onStatusChange(true);
      };

      eventSource.onerror = (err) => {
        if (onStatusChange) onStatusChange(false);
        eventSource.close();
        // Retry connection after 3 seconds
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connect, 3000);
      };

      // Custom event types from backend
      const eventTypes = ["init", "item_added", "item_updated", "item_progress", "item_removed"];
      eventTypes.forEach((type) => {
        eventSource.addEventListener(type, (e) => {
          try {
            const data = JSON.parse(e.data);
            if (onEvent) onEvent(type, data);
          } catch (err) {
            console.error(`Error parsing SSE ${type}:`, err);
          }
        });
      });
    };

    connect();

    return {
      disconnect() {
        clearTimeout(reconnectTimeout);
        if (eventSource) eventSource.close();
      }
    };
  }
};
