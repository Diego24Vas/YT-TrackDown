/**
 * Stream Downloader Module (HLS / M3U8 with Custom Headers & Anti-403)
 * Completely isolated from main YouTube downloader logic.
 * Progressive 3-Stage Architecture matching YouTube downloads:
 * Stage 1: Input / Headers configuration & stream preparation
 * Stage 2: Staged preview & verification visualization card
 * Stage 3: Queue at the bottom section with live progress & status filters
 */

import { icons, ui } from "./ui.js?v=2.0.5";

const UA_PRESETS = {
  chrome: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
  safari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
};

class StreamDownloader {
  constructor() {
    this.pollTimer = null;
    this.tasks = [];
    this.currentFormat = "mp4";
    this.stagedStream = null;
    this.activeFilter = "all";
    this.isPreparing = false;
    this.init();
  }

  init() {
    this.setupFormatTabs();
    this.setupUAPresets();
    this.setupForm();
    this.setupFilterTabs();
    this.loadInitialTasks();
  }

  // Stage 1: Format selector (MP3 / MP4)
  setupFormatTabs() {
    const tabMp3 = document.getElementById("stream-tab-mp3");
    const tabMp4 = document.getElementById("stream-tab-mp4");

    const setFormat = (fmt) => {
      this.currentFormat = fmt;
      if (tabMp3) tabMp3.classList.toggle("is-active", fmt === "mp3");
      if (tabMp4) tabMp4.classList.toggle("is-active", fmt === "mp4");

      // Update staged preview format if open
      if (this.stagedStream) {
        this.stagedStream.format = fmt;
        this.renderPreview();
      }
    };

    if (tabMp3) tabMp3.addEventListener("click", () => setFormat("mp3"));
    if (tabMp4) tabMp4.addEventListener("click", () => setFormat("mp4"));
  }

  setupUAPresets() {
    const chips = document.querySelectorAll(".ua-preset-chip");
    const uaInput = document.getElementById("stream-user-agent");
    if (!uaInput) return;

    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        chips.forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        const key = chip.dataset.ua;
        if (UA_PRESETS[key]) {
          uaInput.value = UA_PRESETS[key];
        }
      });
    });
  }

  setupForm() {
    const btnPaste = document.getElementById("stream-btn-paste");
    const urlInput = document.getElementById("stream-url");
    const btnPrepare = document.getElementById("stream-btn-prepare");
    const btnClearPreview = document.getElementById("stream-btn-clear-preview");
    const btnDownloadPreview = document.getElementById("stream-btn-download-preview");
    const btnClearCompleted = document.getElementById("stream-btn-clear-completed");

    if (btnPaste && urlInput) {
      btnPaste.addEventListener("click", async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            urlInput.value = text.trim();
            urlInput.focus();
          }
        } catch {
          urlInput.focus();
        }
      });
    }

    if (btnPrepare) {
      btnPrepare.addEventListener("click", () => this.handlePrepare());
    }

    if (urlInput) {
      urlInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.handlePrepare();
        }
      });
    }

    if (btnClearPreview) {
      btnClearPreview.addEventListener("click", () => this.clearPreview());
    }

    if (btnDownloadPreview) {
      btnDownloadPreview.addEventListener("click", () => this.startStagedDownload());
    }

    if (btnClearCompleted) {
      btnClearCompleted.addEventListener("click", () => this.clearCompletedTasks());
    }
  }

  setupFilterTabs() {
    const filterTabs = document.querySelectorAll("#stream-filter-tabs .filter-tab");
    filterTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        filterTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        this.activeFilter = tab.dataset.filter || "all";
        this.renderTasks();
      });
    });
  }

  getFormData() {
    const url = document.getElementById("stream-url")?.value?.trim() || "";
    const referer = document.getElementById("stream-referer")?.value?.trim() || "";
    const userAgent = document.getElementById("stream-user-agent")?.value?.trim() || "";
    const customTitle = document.getElementById("stream-title")?.value?.trim() || "";
    const format = this.currentFormat;
    const cookies = document.getElementById("stream-cookies")?.value?.trim() || "";
    const rawHeaders = document.getElementById("stream-custom-headers")?.value || "";

    const customHeaders = {};
    if (rawHeaders) {
      const lines = rawHeaders.split("\n");
      for (const line of lines) {
        const idx = line.indexOf(":");
        if (idx > 0) {
          const key = line.slice(0, idx).trim();
          const val = line.slice(idx + 1).trim();
          if (key && val) customHeaders[key] = val;
        }
      }
    }

    return {
      url,
      referer: referer || null,
      user_agent: userAgent || null,
      custom_title: customTitle || null,
      format,
      cookies: cookies || null,
      custom_headers: Object.keys(customHeaders).length ? customHeaders : null,
    };
  }

  // Stage 1 -> Stage 2: Probe stream & render preview visualization
  async handlePrepare() {
    if (this.isPreparing) return;
    const formData = this.getFormData();
    const urlInput = document.getElementById("stream-url");
    const btnPrepare = document.getElementById("stream-btn-prepare");
    const btnPrepareIcon = document.getElementById("stream-btn-prepare-icon");
    const btnPrepareText = document.getElementById("stream-btn-prepare-text");
    const previewSection = document.getElementById("stream-preview-section");
    const previewList = document.getElementById("stream-preview-list");

    if (!formData.url) {
      ui.showToast("Por favor ingresa una URL de stream válida.", "error", this.currentFormat);
      if (urlInput) urlInput.focus();
      return;
    }

    if (this.isYouTubeUrl(formData.url)) {
      ui.showToast("Los enlaces de YouTube deben descargarse en el apartado 'YouTube (Estándar)' del menú lateral.", "info", this.currentFormat);
      if (urlInput) urlInput.focus();
      return;
    }

    this.isPreparing = true;
    if (btnPrepare) btnPrepare.disabled = true;
    if (btnPrepareIcon) btnPrepareIcon.innerHTML = icons.spinner;
    if (btnPrepareText) btnPrepareText.textContent = "Verificando stream y permisos...";

    // Show skeleton preview while probing
    if (previewSection && previewList) {
      previewSection.style.display = "flex";
      previewSection.classList.remove("is-collapsing");
      ui.renderPreviewLoading(previewList, 1, this.currentFormat);
      previewSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
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

      this.stagedStream = {
        ...formData,
        probe: {
          success: Boolean(data.success),
          status_code: data.status_code || 200,
          title: data.title || null,
          duration: data.duration || null,
          duration_str: data.duration_str || null,
          resolution: data.resolution || null,
          error_message: data.error_message || null,
        },
      };

      this.renderPreview();

      if (data.success) {
        ui.showToast("Stream verificado y preparado para descargar", "success", this.currentFormat);
      } else {
        ui.showToast(data.error_message || "Aviso: El sondeo devolvió restricciones de acceso", "error", this.currentFormat);
      }
    } catch (err) {
      // Even if probe fetch failed, allow staging with fallback
      this.stagedStream = {
        ...formData,
        probe: {
          success: false,
          status_code: 500,
          title: null,
          duration_str: null,
          resolution: null,
          error_message: err.message,
        },
      };
      this.renderPreview();
      ui.showToast("No se pudo verificar el stream, pero puedes intentar la descarga directa.", "info", this.currentFormat);
    } finally {
      this.isPreparing = false;
      if (btnPrepare) btnPrepare.disabled = false;
      if (btnPrepareIcon) {
        btnPrepareIcon.innerHTML = `
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        `;
      }
      if (btnPrepareText) btnPrepareText.textContent = "Preparar y verificar stream";
    }
  }

  // Renders Stage 2: Staged Preview Card
  renderPreview() {
    const previewSection = document.getElementById("stream-preview-section");
    const previewList = document.getElementById("stream-preview-list");
    const previewBtnFormat = document.getElementById("stream-preview-btn-format");
    const previewTitleIcon = document.getElementById("stream-preview-title-icon");

    if (!previewSection || !previewList) return;

    if (!this.stagedStream) {
      previewSection.style.display = "none";
      previewList.innerHTML = "";
      return;
    }

    const item = this.stagedStream;
    const isVideo = item.format === "mp4";
    const formatLabel = isVideo ? "MP4" : "MP3";

    if (previewBtnFormat) {
      previewBtnFormat.textContent = formatLabel;
    }
    if (previewTitleIcon) {
      previewTitleIcon.innerHTML = isVideo ? icons.video : icons.music;
    }

    // Determine card display title
    let displayTitle = item.custom_title;
    if (!displayTitle && item.probe && item.probe.title) {
      displayTitle = item.probe.title;
    }
    if (!displayTitle) {
      try {
        const parsed = new URL(item.url);
        const pathParts = parsed.pathname.split("/").filter(Boolean);
        displayTitle = pathParts.pop() || parsed.hostname;
      } catch {
        displayTitle = "Stream de video";
      }
    }

    const durationBadge = item.probe?.duration_str
      ? `<span class="preview-duration-badge">${item.probe.duration_str}</span>`
      : "";

    const resBadge = item.probe?.resolution
      ? `<span class="format-tag" style="background: rgba(6, 182, 212, 0.15); color: var(--accent-cyan); border-color: rgba(6, 182, 212, 0.3);">${item.probe.resolution}</span>`
      : "";

    let probeBadgeHtml = "";
    if (item.probe?.success) {
      probeBadgeHtml = `<span class="status-badge status-completed" style="font-size:0.75rem;">${icons.check} Conexión autorizada (HTTP 200)</span>`;
    } else if (item.probe?.error_message) {
      probeBadgeHtml = `<span class="status-badge status-error" style="font-size:0.75rem;" title="${this.escapeHtml(item.probe.error_message)}">${icons.alert} HTTP ${item.probe.status_code || 403}</span>`;
    }

    const refererInfo = item.referer
      ? `<span style="color:var(--text-muted); font-size:0.75rem;">&bull; Ref: <code>${this.escapeHtml(item.referer)}</code></span>`
      : "";

    const hintHtml = (!item.probe?.success && (item.probe?.status_code === 403 || item.probe?.status_code === 474))
      ? `<div class="probe-hint" style="margin-top: 8px; font-size: 0.78rem; color: var(--accent-amber);">
          💡 <strong>Aviso 403:</strong> El servidor requiere autenticación o validación de origen. Asegúrate de que el campo <code>Referer</code> contenga la web original del reproductor antes de descargar.
         </div>`
      : "";

    previewList.innerHTML = `
      <div class="preview-card" id="stream-preview-card">
        <div class="preview-thumb-box" style="background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); width: 88px; height: 60px; display: flex; align-items: center; justify-content: center; position: relative;">
          <div style="color: ${isVideo ? 'var(--accent-cyan)' : 'var(--accent-purple, #a855f7)'}; display:flex; align-items:center;">
            ${isVideo ? icons.video : icons.music}
          </div>
          ${durationBadge}
        </div>

        <div class="preview-info" style="flex: 1; min-width: 0;">
          <div class="preview-track-title" title="${this.escapeHtml(displayTitle)}" style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${this.escapeHtml(displayTitle)}
          </div>
          <div class="preview-track-meta" style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px;">
            <span class="format-tag ${isVideo ? 'format-tag-mp4' : 'format-tag-mp3'}">${formatLabel}</span>
            ${resBadge}
            ${probeBadgeHtml}
            ${refererInfo}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 520px;" title="${this.escapeHtml(item.url)}">
            ${this.escapeHtml(item.url)}
          </div>
          ${hintHtml}
        </div>

        <div class="preview-actions" style="display: flex; align-items: center; gap: 8px;">
          <button type="button" class="btn btn-success" id="stream-card-btn-download" style="padding: 7px 14px; font-size: 0.84rem;">
            ${icons.download} Descargar ${formatLabel}
          </button>
          <button type="button" class="btn-icon btn-icon-danger" id="stream-card-btn-remove" title="Descartar preparación">
            ${icons.trash}
          </button>
        </div>
      </div>
    `;

    // Bind card buttons
    const btnCardDownload = document.getElementById("stream-card-btn-download");
    const btnCardRemove = document.getElementById("stream-card-btn-remove");

    if (btnCardDownload) {
      btnCardDownload.addEventListener("click", () => this.startStagedDownload());
    }
    if (btnCardRemove) {
      btnCardRemove.addEventListener("click", () => this.clearPreview());
    }

    previewSection.style.display = "flex";
    previewSection.classList.remove("is-collapsing");
  }

  // Dismiss Stage 2 smoothly
  clearPreview() {
    const previewSection = document.getElementById("stream-preview-section");
    const previewList = document.getElementById("stream-preview-list");
    this.stagedStream = null;

    if (!previewSection || previewSection.style.display === "none") return;

    previewSection.classList.add("is-collapsing");
    setTimeout(() => {
      previewSection.style.display = "none";
      previewSection.classList.remove("is-collapsing");
      if (previewList) previewList.innerHTML = "";
    }, 280);
  }

  // Stage 2 -> Stage 3: Initiate download and advance to Bottom Queue
  async startStagedDownload() {
    if (!this.stagedStream) return;
    const item = this.stagedStream;
    const urlInput = document.getElementById("stream-url");
    const titleInput = document.getElementById("stream-title");
    const btnDownloadPreview = document.getElementById("stream-btn-download-preview");
    const btnCardDownload = document.getElementById("stream-card-btn-download");

    if (btnDownloadPreview) btnDownloadPreview.disabled = true;
    if (btnCardDownload) btnCardDownload.disabled = true;

    try {
      const resp = await fetch("/api/stream/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: item.url,
          referer: item.referer,
          user_agent: item.user_agent,
          custom_title: item.custom_title,
          format: item.format,
          cookies: item.cookies,
          custom_headers: item.custom_headers,
        }),
      });

      const task = await resp.json();
      if (!resp.ok) {
        throw new Error(task.detail || "Error al iniciar la descarga de stream");
      }

      // Smoothly dismiss preview section
      this.clearPreview();

      // Clear input fields
      if (urlInput) urlInput.value = "";
      if (titleInput) titleInput.value = "";

      // Reveal queue at bottom and refresh tasks
      const queueSection = document.getElementById("stream-queue-section");
      if (queueSection) {
        queueSection.style.display = "flex";
        queueSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      await this.refreshTasks();
      this.startPolling();
      ui.showToast("Descarga de stream iniciada y agregada a la cola", "success", item.format);
    } catch (err) {
      ui.showToast(err.message || "Error al iniciar la descarga", "error", item.format);
      if (btnDownloadPreview) btnDownloadPreview.disabled = false;
      if (btnCardDownload) btnCardDownload.disabled = false;
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
      ui.showToast("Descarga eliminada de la cola", "info");
      await this.refreshTasks();
    } catch {}
  }

  async retryTask(taskId) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;

    try {
      await fetch("/api/stream/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: task.url,
          referer: task.referer,
          user_agent: task.user_agent,
          custom_title: task.custom_title,
          format: task.format,
        }),
      });
      await this.deleteTask(taskId);
      await this.refreshTasks();
      this.startPolling();
      ui.showToast("Reintentando descarga de stream...", "info", task.format);
    } catch (err) {
      ui.showToast("Error al reintentar: " + err.message, "error");
    }
  }

  async clearCompletedTasks() {
    try {
      await fetch("/api/stream/clear-completed", { method: "POST" });
      ui.showToast("Descargas completadas eliminadas de la cola", "info");
      await this.refreshTasks();
    } catch {}
  }

  // Stage 3: Render Bottom Queue Section
  renderTasks() {
    const container = document.getElementById("stream-queue-list");
    const counterBadge = document.getElementById("stream-queue-counter");
    const clearBtn = document.getElementById("stream-btn-clear-completed");
    const queueSection = document.getElementById("stream-queue-section");

    if (!container) return;

    // Progressive appearance: If no tasks exist and no active preview, hide queue section
    if (this.tasks.length === 0) {
      if (queueSection) queueSection.style.display = "none";
      if (counterBadge) counterBadge.textContent = "0/0";
      if (clearBtn) clearBtn.style.display = "none";
      container.innerHTML = "";
      return;
    }

    if (queueSection) {
      queueSection.style.display = "flex";
    }

    const completedCount = this.tasks.filter((t) => t.status === "completed").length;
    if (counterBadge) {
      counterBadge.textContent = `${completedCount}/${this.tasks.length}`;
    }

    const hasClearable = this.tasks.some(
      (t) => t.status === "completed" || t.status === "error" || t.status === "cancelled"
    );
    if (clearBtn) {
      clearBtn.style.display = hasClearable ? "inline-flex" : "none";
    }

    // Filter tasks
    const filteredTasks = this.tasks.filter((t) => {
      if (this.activeFilter === "downloading") {
        return t.status === "queued" || t.status === "downloading" || t.status === "converting";
      }
      if (this.activeFilter === "completed") {
        return t.status === "completed";
      }
      if (this.activeFilter === "error") {
        return t.status === "error" || t.status === "cancelled";
      }
      return true; // "all"
    });

    if (filteredTasks.length === 0) {
      container.innerHTML = `
        <div class="empty-queue">
          <div class="empty-icon">${this.currentFormat === "mp4" ? icons.video : icons.music}</div>
          <div class="empty-title">No hay descargas en esta vista</div>
          <div class="empty-desc">No se encontraron elementos correspondientes al filtro seleccionado.</div>
        </div>
      `;
      return;
    }

    // High performance DOM reconciliation: if IDs match, update progress DOM only
    const existingCards = container.querySelectorAll(".item-card");
    const existingIds = Array.from(existingCards).map((c) => c.dataset.id);
    const newIds = filteredTasks.map((t) => t.id);

    const idsIdentical =
      existingIds.length === newIds.length &&
      existingIds.every((id, idx) => id === newIds[idx]);

    if (idsIdentical) {
      filteredTasks.forEach((t) => this.updateCardProgress(t));
      return;
    }

    // Full render of filtered list (newest first)
    const sorted = [...filteredTasks].reverse();
    container.innerHTML = sorted.map((t) => this.createTaskCardHtml(t)).join("");
  }

  createTaskCardHtml(task) {
    const isVideo = task.format === "mp4";
    const formatLabel = isVideo ? "MP4" : "MP3";
    const title = task.title || task.custom_title || task.filename || "Stream de Video";
    const progress = task.progress || {};
    const percentage = progress.percentage || 0;

    let progressFillClass = "";
    if (task.status === "converting") progressFillClass = "converting";
    if (task.status === "completed") progressFillClass = "completed";

    let statusBadgeClass = "badge-stream-downloading";
    let statusText = "Descargando...";
    let statusIcon = icons.spinner;

    if (task.status === "queued") {
      statusText = "En cola";
      statusIcon = icons.clock;
    } else if (task.status === "converting") {
      statusBadgeClass = "badge-stream-converting";
      statusText = "Procesando...";
      statusIcon = icons.soundwave;
    } else if (task.status === "completed") {
      statusBadgeClass = "badge-stream-completed";
      statusText = "Completado";
      statusIcon = icons.check;
    } else if (task.status === "error") {
      statusBadgeClass = "badge-stream-error";
      statusText = "Error";
      statusIcon = icons.alert;
    }

    const speed = progress.speed_str || "";
    const eta = progress.eta_str ? `ETA: ${progress.eta_str}` : "";
    const sizeStr = task.file_size_str || "";

    const sizeBadge = task.file_size_str
      ? `<span class="item-size-badge">${task.file_size_str}</span>`
      : "";

    let actionBtnHtml = "";
    if (task.status === "completed") {
      const ext = isVideo ? ".mp4" : ".mp3";
      const defaultBase = isVideo ? "stream_video" : "stream_audio";
      let rawTitle = (task.title || defaultBase).replace(/[\\/*?:"<>|]/g, "").trim();
      const cleanDownloadName = rawTitle.toLowerCase().endsWith(ext) ? rawTitle : `${rawTitle || defaultBase}${ext}`;

      actionBtnHtml = `
        <a href="/api/stream/tasks/${task.id}/file" download="${cleanDownloadName}" class="btn btn-success" style="padding: 6px 12px; font-size: 0.82rem;" title="Guardar archivo ${formatLabel}">
          ${icons.download} Guardar ${formatLabel}
        </a>
      `;
    } else if (task.status === "error") {
      actionBtnHtml = `
        <button type="button" class="btn btn-secondary btn-retry" onclick="window.streamDownloader.retryTask('${task.id}')" style="padding: 6px 12px; font-size: 0.82rem;" title="Reintentar descarga">
          ${icons.refresh} Reintentar
        </button>
      `;
    }

    const errorHtml = task.error_message
      ? `<div class="item-error-msg" style="margin-top: 6px; padding: 6px 10px; background: var(--accent-rose-bg); border-left: 3px solid var(--accent-rose); border-radius: 4px; font-size: 0.78rem; color: #fb7185;">${this.escapeHtml(task.error_message)}</div>`
      : "";

    return `
      <div class="item-card" id="stream-card-${task.id}" data-id="${task.id}" data-status="${task.status}">
        <div class="item-thumb-box">
          <div class="item-thumb-placeholder">
            ${isVideo ? icons.video : icons.music}
          </div>
        </div>

        <div class="item-content">
          <div class="item-header-row">
            <div style="min-width:0; flex:1;">
              <div class="item-title" title="${this.escapeHtml(title)}">${this.escapeHtml(title)}</div>
              <div class="item-meta-row">
                <span><span class="format-tag ${isVideo ? 'format-tag-mp4' : 'format-tag-mp3'}">${formatLabel}</span></span>
                ${sizeBadge}
                <span style="color:var(--text-muted); font-size: 0.75rem; overflow:hidden; text-overflow:ellipsis; max-width:340px; display:inline-block; vertical-align:bottom;" title="${this.escapeHtml(task.url)}">
                  ${task.referer ? `Ref: ${this.escapeHtml(task.referer)} &bull; ` : ""}${this.escapeHtml(task.url)}
                </span>
              </div>
            </div>
            <div id="stream-status-badge-${task.id}" class="item-status-wrapper">
              <span class="status-badge ${statusBadgeClass}">
                ${statusIcon}
                <span>${statusText}</span>
              </span>
            </div>
          </div>

          <!-- Progress Track -->
          <div class="progress-wrap">
            <div class="progress-track">
              <div class="progress-fill ${progressFillClass}" id="stream-progress-fill-${task.id}" style="width: ${percentage}%;"></div>
            </div>
            <div class="progress-info-row tabular" id="stream-progress-info-${task.id}">
              <span>${task.status === "completed" ? "Listo para guardar" : speed}</span>
              <span>${task.status === "completed" && sizeStr ? "Peso final: " + sizeStr : (eta ? eta + " • " : "") + sizeStr}</span>
            </div>
          </div>

          ${errorHtml}
        </div>

        <div class="item-actions">
          <div id="stream-action-slot-${task.id}" class="item-action-slot">
            ${actionBtnHtml}
          </div>
          <button type="button" class="btn-icon btn-icon-danger" onclick="window.streamDownloader.deleteTask('${task.id}')" title="Eliminar de la lista">
            ${icons.trash}
          </button>
        </div>
      </div>
    `;
  }

  updateCardProgress(task) {
    const card = document.getElementById(`stream-card-${task.id}`);
    if (!card) return;

    const fill = document.getElementById(`stream-progress-fill-${task.id}`);
    const info = document.getElementById(`stream-progress-info-${task.id}`);
    const badgeSlot = document.getElementById(`stream-status-badge-${task.id}`);
    const actionSlot = document.getElementById(`stream-action-slot-${task.id}`);

    const progress = task.progress || {};
    const percentage = progress.percentage || 0;
    const isVideo = task.format === "mp4";
    const formatLabel = isVideo ? "MP4" : "MP3";

    if (card) card.dataset.status = task.status;

    if (fill) {
      fill.style.width = `${percentage}%`;
      if (task.status === "converting") {
        fill.className = "progress-fill converting";
      } else if (task.status === "completed") {
        fill.className = "progress-fill completed";
      } else {
        fill.className = "progress-fill";
      }
    }

    if (info) {
      const speed = progress.speed_str || "";
      const eta = progress.eta_str ? `ETA: ${progress.eta_str}` : "";
      const sizeStr = task.file_size_str || "";
      if (task.status === "completed") {
        info.innerHTML = `<span>Listo para guardar</span><span>${sizeStr ? "Peso final: " + sizeStr : ""}</span>`;
      } else {
        info.innerHTML = `<span>${speed}</span><span>${eta ? eta + " • " : ""}${sizeStr}</span>`;
      }
    }

    if (badgeSlot) {
      let statusBadgeClass = "badge-stream-downloading";
      let statusText = `Descargando ${percentage.toFixed(0)}%`;
      let statusIcon = icons.spinner;

      if (task.status === "queued") {
        statusText = "En cola";
        statusIcon = icons.clock;
      } else if (task.status === "converting") {
        statusBadgeClass = "badge-stream-converting";
        statusText = "Procesando...";
        statusIcon = icons.soundwave;
      } else if (task.status === "completed") {
        statusBadgeClass = "badge-stream-completed";
        statusText = "Completado";
        statusIcon = icons.check;
      } else if (task.status === "error") {
        statusBadgeClass = "badge-stream-error";
        statusText = "Error";
        statusIcon = icons.alert;
      }

      badgeSlot.innerHTML = `
        <span class="status-badge ${statusBadgeClass}">
          ${statusIcon}
          <span>${statusText}</span>
        </span>
      `;
    }

    if (actionSlot && task.status === "completed" && !actionSlot.querySelector("a")) {
      const ext = isVideo ? ".mp4" : ".mp3";
      const defaultBase = isVideo ? "stream_video" : "stream_audio";
      let rawTitle = (task.title || defaultBase).replace(/[\\/*?:"<>|]/g, "").trim();
      const cleanDownloadName = rawTitle.toLowerCase().endsWith(ext) ? rawTitle : `${rawTitle || defaultBase}${ext}`;

      actionSlot.innerHTML = `
        <a href="/api/stream/tasks/${task.id}/file" download="${cleanDownloadName}" class="btn btn-success" style="padding: 6px 12px; font-size: 0.82rem;" title="Guardar archivo ${formatLabel}">
          ${icons.download} Guardar ${formatLabel}
        </a>
      `;
    }
  }

  isYouTubeUrl(url) {
    const clean = (url || "").trim().toLowerCase();
    return clean.includes("youtube.com") || clean.includes("youtu.be");
  }

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// Instantiate and expose globally
window.streamDownloader = new StreamDownloader();
