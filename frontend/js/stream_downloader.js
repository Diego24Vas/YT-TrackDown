/**
 * Stream Downloader Module (HLS / M3U8 with Custom Headers & Anti-403)
 * Completely isolated from main YouTube downloader logic.
 */

const UA_PRESETS = {
  chrome: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
  safari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
};

class StreamDownloader {
  constructor() {
    this.pollTimer = null;
    this.tasks = [];
    this.init();
  }

  init() {
    this.setupNavigation();
    this.setupForm();
    this.setupUAPresets();
    this.loadInitialTasks();
  }

  setupNavigation() {
    const navBtnYoutube = document.getElementById("nav-btn-youtube");
    const navBtnStream = document.getElementById("nav-btn-stream");
    const heroSection = document.getElementById("hero-section");
    const previewSection = document.getElementById("preview-section");
    const queueSection = document.getElementById("queue-section");
    const streamSection = document.getElementById("stream-downloader-section");

    if (!navBtnYoutube || !navBtnStream || !streamSection) return;

    navBtnYoutube.addEventListener("click", () => {
      navBtnYoutube.classList.add("is-active");
      navBtnStream.classList.remove("is-active");

      streamSection.style.display = "none";
      if (heroSection) heroSection.style.display = "";
      // queueSection and previewSection preserve their existing state
      if (queueSection) {
        // If queue has items, it was visible; otherwise it maintains its state
        queueSection.style.display = queueSection.dataset.wasVisible === "false" ? "none" : "";
      }
      if (previewSection && previewSection.dataset.wasVisible === "true") {
        previewSection.style.display = "";
      }
    });

    navBtnStream.addEventListener("click", () => {
      navBtnStream.classList.add("is-active");
      navBtnYoutube.classList.remove("is-active");

      // Remember visibility before hiding
      if (queueSection) {
        queueSection.dataset.wasVisible = queueSection.style.display === "none" ? "false" : "true";
        queueSection.style.display = "none";
      }
      if (previewSection) {
        previewSection.dataset.wasVisible = previewSection.style.display === "none" ? "false" : "true";
        previewSection.style.display = "none";
      }
      if (heroSection) {
        heroSection.style.display = "none";
      }

      streamSection.style.display = "flex";
      this.refreshTasks();
    });
  }

  setupUAPresets() {
    const chips = document.querySelectorAll(".ua-preset-chip");
    const uaInput = document.getElementById("stream-user-agent");
    if (!uaInput) return;

    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        chips.forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");

        const presetKey = chip.dataset.ua;
        if (presetKey && UA_PRESETS[presetKey]) {
          uaInput.value = UA_PRESETS[presetKey];
        }
      });
    });
  }

  setupForm() {
    const btnPaste = document.getElementById("stream-btn-paste");
    const urlInput = document.getElementById("stream-url");
    const btnProbe = document.getElementById("stream-btn-probe");
    const btnDownload = document.getElementById("stream-btn-download");
    const probeResultCard = document.getElementById("stream-probe-card");
    const btnClearCompleted = document.getElementById("stream-btn-clear-completed");

    if (btnPaste && urlInput) {
      btnPaste.addEventListener("click", async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            urlInput.value = text.trim();
            this.autoSuggestReferer(text.trim());
          }
        } catch {
          urlInput.focus();
        }
      });

      urlInput.addEventListener("input", () => {
        this.autoSuggestReferer(urlInput.value.trim());
      });
    }

    if (btnProbe) {
      btnProbe.addEventListener("click", () => this.handleProbe());
    }

    if (btnDownload) {
      btnDownload.addEventListener("click", () => this.handleDownload());
    }

    if (btnClearCompleted) {
      btnClearCompleted.addEventListener("click", () => this.clearCompletedTasks());
    }
  }

  autoSuggestReferer(url) {
    const refererInput = document.getElementById("stream-referer");
    if (!refererInput || refererInput.value.trim()) return;

    // If user pasted a webpage link rather than .m3u8, they might want that as referer
    try {
      if (url.startsWith("http://") || url.startsWith("https://")) {
        const parsed = new URL(url);
        // Only suggest if not direct m3u8
        if (!url.toLowerCase().includes(".m3u8")) {
          refererInput.placeholder = `Sugerencia: ${parsed.origin}/`;
        }
      }
    } catch {}
  }

  getFormData() {
    const urlInput = document.getElementById("stream-url");
    const refererInput = document.getElementById("stream-referer");
    const uaInput = document.getElementById("stream-user-agent");
    const cookiesInput = document.getElementById("stream-cookies");
    const customHeadersInput = document.getElementById("stream-custom-headers");
    const titleInput = document.getElementById("stream-title");
    const formatSelect = document.getElementById("stream-format");

    const url = (urlInput?.value || "").trim();
    const referer = (refererInput?.value || "").trim() || null;
    const userAgent = (uaInput?.value || "").trim() || null;
    const cookies = (cookiesInput?.value || "").trim() || null;
    const customTitle = (titleInput?.value || "").trim() || null;
    const format = formatSelect?.value || "mp4";

    // Parse custom headers lines (Key: Value)
    const customHeaders = {};
    if (customHeadersInput && customHeadersInput.value.trim()) {
      const lines = customHeadersInput.value.split("\n");
      for (const line of lines) {
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0) {
          const k = line.substring(0, colonIdx).trim();
          const v = line.substring(colonIdx + 1).trim();
          if (k && v) customHeaders[k] = v;
        }
      }
    }

    return {
      url,
      referer,
      user_agent: userAgent,
      cookies,
      custom_headers: Object.keys(customHeaders).length ? customHeaders : null,
      custom_title: customTitle,
      format,
    };
  }

  async handleProbe() {
    const formData = this.getFormData();
    const probeCard = document.getElementById("stream-probe-card");
    const btnProbe = document.getElementById("stream-btn-probe");

    if (!formData.url) {
      this.showProbeResult(false, "Por favor, introduce una URL para verificar.");
      return;
    }

    if (btnProbe) {
      btnProbe.disabled = true;
      btnProbe.textContent = "Verificando...";
    }

    try {
      const resp = await fetch("/api/stream/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: formData.url,
          referer: formData.referer,
          user_agent: formData.user_agent,
          cookies: formData.cookies,
          custom_headers: formData.custom_headers,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.detail || "Error en el servidor");
      }

      if (data.success) {
        this.showProbeResult(true, "Enlace y cabeceras verificados con éxito (Acceso Autorizado)", data);
      } else {
        this.showProbeResult(false, data.error_message || "No se pudo acceder al stream.");
      }
    } catch (err) {
      this.showProbeResult(false, err.message || "Error al conectar con el servidor.");
    } finally {
      if (btnProbe) {
        btnProbe.disabled = false;
        btnProbe.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          Probar enlace
        `;
      }
    }
  }

  showProbeResult(success, message, data = null) {
    const probeCard = document.getElementById("stream-probe-card");
    if (!probeCard) return;

    probeCard.style.display = "block";
    probeCard.className = `stream-probe-card ${success ? "stream-probe-success" : "stream-probe-error"}`;

    let detailsHtml = "";
    if (success && data) {
      detailsHtml = `
        <div class="stream-probe-details">
          ${data.title ? `<span>🎬 <strong>Título:</strong> ${this.escapeHtml(data.title)}</span>` : ""}
          ${data.resolution ? `<span>📐 <strong>Resolución:</strong> ${data.resolution}</span>` : ""}
          ${data.duration_str ? `<span>⏱️ <strong>Duración:</strong> ${data.duration_str}</span>` : ""}
        </div>
      `;
    }

    probeCard.innerHTML = `
      <div class="stream-probe-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${success ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>' : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'}
        </svg>
        <span>${this.escapeHtml(message)}</span>
      </div>
      ${detailsHtml}
    `;
  }

  async handleDownload() {
    const formData = this.getFormData();
    const btnDownload = document.getElementById("stream-btn-download");
    const urlInput = document.getElementById("stream-url");

    if (!formData.url) {
      alert("Por favor, introduce una URL de video o stream.");
      return;
    }

    if (btnDownload) {
      btnDownload.disabled = true;
    }

    try {
      const resp = await fetch("/api/stream/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const task = await resp.json();
      if (!resp.ok) {
        throw new Error(task.detail || "Error al iniciar la descarga");
      }

      // Clear input and reload tasks
      if (urlInput) urlInput.value = "";
      const probeCard = document.getElementById("stream-probe-card");
      if (probeCard) probeCard.style.display = "none";

      await this.refreshTasks();
      this.startPolling();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      if (btnDownload) {
        btnDownload.disabled = false;
      }
    }
  }

  async loadInitialTasks() {
    await this.refreshTasks();
    if (this.hasActiveTasks()) {
      this.startPolling();
    }
  }

  async refreshTasks() {
    try {
      const resp = await fetch("/api/stream/tasks");
      if (!resp.ok) return;
      this.tasks = await resp.json();
      this.renderTasks();
    } catch {}
  }

  hasActiveTasks() {
    return this.tasks.some(
      (t) => t.status === "queued" || t.status === "downloading" || t.status === "converting"
    );
  }

  startPolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(async () => {
      await this.refreshTasks();
      if (!this.hasActiveTasks()) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    }, 1200);
  }

  async deleteTask(taskId) {
    try {
      await fetch(`/api/stream/tasks/${taskId}`, { method: "DELETE" });
      await this.refreshTasks();
    } catch {}
  }

  async clearCompletedTasks() {
    try {
      await fetch("/api/stream/clear-completed", { method: "POST" });
      await this.refreshTasks();
    } catch {}
  }

  renderTasks() {
    const container = document.getElementById("stream-tasks-list");
    const countBadge = document.getElementById("stream-tasks-counter");
    const clearBtn = document.getElementById("stream-btn-clear-completed");

    if (!container) return;

    if (countBadge) {
      countBadge.textContent = `${this.tasks.length}`;
    }

    const hasCompleted = this.tasks.some(
      (t) => t.status === "completed" || t.status === "error"
    );
    if (clearBtn) {
      clearBtn.style.display = hasCompleted ? "inline-flex" : "none";
    }

    if (!this.tasks.length) {
      container.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-muted); font-size: 0.85rem;">
          No hay descargas de stream activas ni recientes.
        </div>
      `;
      return;
    }

    // Sort: newest first
    const sorted = [...this.tasks].reverse();

    container.innerHTML = sorted
      .map((t) => {
        const isVideo = t.format === "mp4";
        const progress = t.progress || {};
        const pct = progress.percentage || 0;

        let badgeClass = "badge-stream-downloading";
        let statusLabel = "Descargando...";
        if (t.status === "queued") {
          statusLabel = "En cola...";
        } else if (t.status === "converting") {
          badgeClass = "badge-stream-converting";
          statusLabel = "Procesando...";
        } else if (t.status === "completed") {
          badgeClass = "badge-stream-completed";
          statusLabel = "Completado";
        } else if (t.status === "error") {
          badgeClass = "badge-stream-error";
          statusLabel = "Error";
        }

        const statsText =
          t.status === "completed"
            ? `${t.file_size_str || ""} • Listo para guardar`
            : t.status === "error"
            ? t.error_message || "Error al descargar"
            : `${progress.speed_str || ""} ${progress.eta_str ? `• Restante: ${progress.eta_str}` : ""}`;

        return `
          <div class="stream-task-card" id="stream-task-${t.id}">
            <div class="stream-task-header">
              <div class="stream-task-meta">
                <div class="stream-task-icon">
                  ${
                    isVideo
                      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                          <line x1="7" y1="2" x2="7" y2="22"></line>
                          <line x1="17" y1="2" x2="17" y2="22"></line>
                          <line x1="2" y1="12" x2="22" y2="12"></line>
                        </svg>`
                      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M9 18V5l12-2v13"></path>
                          <circle cx="6" cy="18" r="3"></circle>
                          <circle cx="18" cy="16" r="3"></circle>
                        </svg>`
                  }
                </div>
                <div class="stream-task-info">
                  <div class="stream-task-title">${this.escapeHtml(t.title || t.filename || "Stream Video")}</div>
                  <div class="stream-task-url" title="${this.escapeHtml(t.url)}">${this.escapeHtml(t.url)}</div>
                </div>
              </div>

              <div class="stream-task-actions">
                <span class="stream-task-status-badge ${badgeClass}">${statusLabel}</span>

                ${
                  t.status === "completed"
                    ? `<a href="/api/stream/tasks/${t.id}/file" download class="btn btn-success" style="padding: 5px 12px; font-size: 0.8rem; text-decoration: none;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Descargar
                       </a>`
                    : ""
                }

                <button type="button" class="btn btn-secondary btn-ghost" style="padding: 5px 8px;" onclick="window.streamDownloader.deleteTask('${t.id}')" title="Eliminar elemento">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>

            ${
              t.status !== "completed" && t.status !== "error"
                ? `
                  <div class="stream-progress-track">
                    <div class="stream-progress-bar" style="width: ${pct}%"></div>
                  </div>
                `
                : ""
            }

            <div class="stream-progress-stats">
              <span style="${t.status === "error" ? "color: var(--accent-rose);" : ""}">${this.escapeHtml(statsText)}</span>
              ${
                t.status === "downloading"
                  ? `<span class="tabular">${pct.toFixed(1)}%</span>`
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");
  }

  escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// Instantiate and expose globally for inline action buttons
window.streamDownloader = new StreamDownloader();
