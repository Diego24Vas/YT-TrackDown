/**
 * UI Rendering and DOM manipulation layer
 */

// SVG Icon Helpers
export const icons = {
  music: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  download: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  spinner: `<svg class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`,
  clock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  alert: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  trash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  refresh: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  zip: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  soundwave: `<svg class="pulsing" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/></svg>`,
  video: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`,
  externalLink: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
};

export const ui = {
  /**
   * Formats bytes into human-readable string (KB, MB, GB)
   */
  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let n = parseFloat(bytes);
    let idx = 0;
    while (n >= 1024 && idx < units.length - 1) {
      n /= 1024;
      idx++;
    }
    return `${n.toFixed(1)} ${units[idx]}`;
  },

  /**
   * Parses text and extracts valid http/https URLs
   */
  extractUrls(text) {
    if (!text) return [];
    // Match URLs starting with http:// or https://
    const matches = text.match(/https?:\/\/[^\s,;"'<>()]+/gi) || [];
    // Deduplicate while preserving order
    return Array.from(new Set(matches.map((u) => u.trim())));
  },

  /**
   * Extracts YouTube 11-char video ID if present
   */
  extractVideoId(url) {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
    return match ? match[1] : null;
  },

  /**
   * Extracts playlist ID (from ?list=... or &list=...)
   */
  extractPlaylistId(url) {
    if (!url) return null;
    const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
    return match ? match[1] : null;
  },

  /**
   * Compares two URLs for equivalence (handling short vs full YouTube URLs)
   */
  urlsMatch(url1, url2) {
    if (!url1 || !url2) return false;
    if (url1.trim() === url2.trim()) return true;
    const id1 = this.extractVideoId(url1);
    const id2 = this.extractVideoId(url2);
    if (id1 && id2 && id1 === id2) return true;
    return false;
  },

  /**
   * Checks whether a preview item belongs to any URL currently in the textarea
   */
  itemMatchesUrlList(item, urls) {
    if (!item || !urls || urls.length === 0) return false;
    for (const u of urls) {
      // 1. If URL has a playlist parameter, match playlist ID
      const uPlaylistId = this.extractPlaylistId(u);
      if (uPlaylistId) {
        if (item.playlist_id && item.playlist_id === uPlaylistId) return true;
        if (item.source_url && this.extractPlaylistId(item.source_url) === uPlaylistId) return true;
      }
      // 2. Match source_url
      if (item.source_url && this.urlsMatch(u, item.source_url)) return true;
      // 3. Match track url
      if (this.urlsMatch(u, item.url)) return true;
    }
    return false;
  },

  /**
   * Displays non-intrusive toast alert
   */
  showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let iconHtml = icons.music;
    if (type === "success") iconHtml = icons.check;
    if (type === "error") iconHtml = icons.alert;

    toast.innerHTML = `<span class="toast-icon">${iconHtml}</span><span class="toast-msg">${message}</span>`;
    
    // Smooth exit upwards
    let isDismissed = false;
    const dismiss = () => {
      if (isDismissed) return;
      isDismissed = true;
      toast.style.transition = "opacity 0.25s ease, transform 0.25s ease";
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-14px) scale(0.96)";
      setTimeout(() => toast.remove(), 250);
    };

    // User can tap or click to dismiss immediately
    toast.addEventListener("click", dismiss);

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) dismiss();
    }, 3200);
  },

  /**
   * Renders status pill badge
   */
  renderStatusBadge(status, percentage = 0, format = "mp3") {
    switch (status) {
      case "queued":
        return `<span class="status-badge badge-queued">${icons.clock} En espera</span>`;
      case "fetching_info":
        return `<span class="status-badge badge-fetching">${icons.spinner} Analizando info</span>`;
      case "downloading":
        return `<span class="status-badge badge-downloading tabular">${icons.spinner} Descargando ${percentage.toFixed(0)}%</span>`;
      case "converting":
        return format === "mp4"
          ? `<span class="status-badge badge-converting">${icons.video} Uniendo video MP4</span>`
          : `<span class="status-badge badge-converting">${icons.soundwave} Convirtiendo a MP3</span>`;
      case "completed":
        return `<span class="status-badge badge-completed">${icons.check} Completado</span>`;
      case "expired":
        return `<span class="status-badge badge-expired" title="El archivo se eliminó automáticamente del servidor tras 15 min">${icons.clock} Expirado (15m)</span>`;
      case "error":
        return `<span class="status-badge badge-error">${icons.alert} Error</span>`;
      default:
        return `<span class="status-badge badge-queued">${status}</span>`;
    }
  },

  /**
   * Builds single card HTML string
   */
  createCardHtml(item) {
    const isVideo = item.format === "mp4";
    const formatLabel = isVideo ? "MP4" : "MP3";
    const qualityText = isVideo
      ? (item.quality === "best" ? "Máx" : `${item.quality}p`)
      : `${item.quality}kbps`;

    const formatBadge = isVideo
      ? `<span class="format-tag format-tag-mp4">MP4 ${qualityText}</span>`
      : `<span class="format-tag format-tag-mp3">MP3 ${qualityText}</span>`;

    const title = item.title || item.url;
    const artist = item.artist ? `${item.artist} • ` : "";
    const percentage = item.progress?.percentage || (item.status === "completed" ? 100 : 0);
    const speed = item.progress?.speed_str || "";
    const eta = item.progress?.eta_str ? `ETA: ${item.progress.eta_str}` : "";
    const sizeStr = item.file_size_str || "";
    const sizeBadge = item.file_size_str
      ? `<span class="item-size-badge" title="Peso del archivo ${formatLabel}">${item.file_size_str}</span>`
      : "";

    const thumbHtml = item.thumbnail
      ? `<img src="${item.thumbnail}" alt="" class="item-thumb-img" loading="lazy">`
      : `<div class="item-thumb-placeholder">${isVideo ? icons.video : icons.music}</div>`;

    const durationHtml = item.duration_str
      ? `<span class="item-duration-badge">${item.duration_str}</span>`
      : "";

    let progressFillClass = "";
    if (item.status === "converting") progressFillClass = "converting";
    if (item.status === "completed") progressFillClass = "completed";
    if (item.status === "expired") progressFillClass = "expired";

    let actionBtnHtml = "";
    if (item.status === "completed") {
      const ext = isVideo ? ".mp4" : ".mp3";
      const defaultBase = isVideo ? "video" : "audio";
      let rawTitle = (item.title || defaultBase)
        .replace(/^[a-fA-F0-9]{10}_/, "")
        .replace(/\s*[\(\[]\s*(?:video\s+oficial|official\s+video|official\s+music\s+video|audio\s+oficial|official\s+audio|video\s+lyric|lyric\s+video|(?:official\s+|audio\s+)?visualizer(?:\s+video)?)\s*[\)\]]/gi, "")
        .replace(/\s*[-–—|]\s*(?:video\s+oficial|official\s+video|audio\s+oficial|official\s+audio|(?:official\s+|audio\s+)?visualizer(?:\s+video)?)\s*$/gi, "")
        .replace(/[\s\-–—|_]+$/, "")
        .replace(/[\\/*?:"<>|]/g, "")
        .trim();
      const cleanDownloadName = rawTitle.toLowerCase().endsWith(ext) ? rawTitle : `${rawTitle || defaultBase}${ext}`;
      actionBtnHtml = `
        <a href="/api/downloads/${item.id}/file" download="${cleanDownloadName.replace(/"/g, '&quot;')}" class="btn btn-success" style="padding: 6px 12px; font-size: 0.82rem;" title="Guardar archivo ${formatLabel}">
          ${icons.download} Guardar ${formatLabel}
        </a>
      `;
    } else if (item.status === "expired") {
      actionBtnHtml = `
        <button class="btn btn-secondary btn-retry" data-id="${item.id}" style="padding: 6px 12px; font-size: 0.82rem;" title="El archivo se eliminó tras 15 minutos para liberar espacio. Haz clic para volver a descargarlo">
          ${icons.refresh} Re-descargar
        </button>
      `;
    } else if (item.status === "error") {
      actionBtnHtml = `
        <button class="btn btn-secondary btn-retry" data-id="${item.id}" style="padding: 6px 12px; font-size: 0.82rem;" title="Reintentar descarga">
          ${icons.refresh} Reintentar
        </button>
      `;
    }

    const expiredNoticeHtml = item.status === "expired"
      ? `<div class="item-expired-msg" style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Archivo eliminado del servidor tras 15 min para liberar espacio.</div>`
      : "";

    const errorHtml = item.error_message
      ? `<div class="item-error-msg">${item.error_message}</div>`
      : "";

    return `
      <div class="item-card" id="card-${item.id}" data-id="${item.id}" data-status="${item.status}">
        <div class="item-thumb-box">
          ${thumbHtml}
          ${durationHtml}
        </div>

        <div class="item-content">
          <div class="item-header-row">
            <div style="min-width:0; flex:1;">
              <div class="item-title" title="${title}">${title}</div>
              <div class="item-meta-row">
                <span>${artist}${formatBadge}</span>
                ${sizeBadge}
                <a href="${item.url}" target="_blank" rel="noopener noreferrer" style="color:var(--text-muted); display:inline-flex; align-items:center; gap:2px;" title="Abrir enlace original">
                  ${icons.externalLink}
                </a>
              </div>
            </div>
            <div id="status-badge-${item.id}" class="item-status-wrapper">
              ${this.renderStatusBadge(item.status, percentage, item.format)}
            </div>
          </div>

          <!-- Progress Track -->
          <div class="progress-wrap">
            <div class="progress-track">
              <div class="progress-fill ${progressFillClass}" id="progress-fill-${item.id}" style="width: ${percentage}%;"></div>
            </div>
            <div class="progress-info-row tabular" id="progress-info-${item.id}">
              <span>${item.status === "completed" ? "Listo para guardar" : speed}</span>
              <span>${item.status === "completed" && sizeStr ? "Peso final: " + sizeStr : (eta ? eta + " • " : "") + sizeStr}</span>
            </div>
          </div>

          ${errorHtml}
          ${expiredNoticeHtml}
        </div>

        <div class="item-actions">
          <div id="action-slot-${item.id}" class="item-action-slot">
            ${actionBtnHtml}
          </div>
          <button class="btn-icon btn-icon-danger btn-delete" data-id="${item.id}" title="Eliminar de la lista">
            ${icons.trash}
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Updates only progress bar and text in DOM for high performance
   */
  updateProgressDOM(item) {
    const card = document.getElementById(`card-${item.id}`);
    if (!card) return;

    const fill = document.getElementById(`progress-fill-${item.id}`);
    const info = document.getElementById(`progress-info-${item.id}`);
    const badgeSlot = document.getElementById(`status-badge-${item.id}`);

    const percentage = item.progress?.percentage || 0;

    if (fill) {
      fill.style.width = `${percentage}%`;
      if (item.status === "converting") {
        fill.className = "progress-fill converting";
      } else if (item.status === "completed") {
        fill.className = "progress-fill completed";
      } else {
        fill.className = "progress-fill";
      }
    }

    if (card && item.status) {
      card.dataset.status = item.status;
    }

    if (info) {
      const speed = item.progress?.speed_str || "";
      const eta = item.progress?.eta_str ? `ETA: ${item.progress.eta_str}` : "";
      const sizeStr = item.file_size_str || "";
      if (item.status === "completed") {
        info.innerHTML = `<span>Listo para guardar</span><span>${sizeStr ? "Peso final: " + sizeStr : ""}</span>`;
      } else {
        info.innerHTML = `<span>${speed}</span><span>${eta ? eta + " • " : ""}${sizeStr}</span>`;
      }
    }

    if (badgeSlot) {
      badgeSlot.innerHTML = this.renderStatusBadge(item.status, percentage, item.format);
    }
  },

  /**
   * Updates entire single card state (e.g. when completed or error)
   */
  updateCardDOM(item) {
    const card = document.getElementById(`card-${item.id}`);
    if (!card) return;

    // Fast replace
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = this.createCardHtml(item);
    const newCard = tempDiv.firstElementChild;
    card.replaceWith(newCard);
  },

  /**
   * Full render of list container
   */
  renderList(container, items) {
    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="empty-queue">
          <div class="empty-icon">${icons.music}</div>
          <div class="empty-title">No hay descargas en la cola</div>
          <div class="empty-desc">Pega uno o más enlaces de YouTube en el campo superior para comenzar a descargar en formato MP3 o MP4.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map((i) => this.createCardHtml(i)).join("");
  },

  /**
   * Updates header and stats counters
   */
  updateStats(stats) {
    const counterBadge = document.getElementById("queue-counter");
    if (counterBadge) {
      counterBadge.textContent = `${stats.completed}/${stats.total}`;
    }

    // Zip button visibility: only show if completed > 0
    const zipBtn = document.getElementById("btn-download-zip");
    if (zipBtn) {
      const isVisible = stats.completed > 0;
      zipBtn.style.display = isVisible ? "inline-flex" : "none";
      if (isVisible) {
        const totalSize = this.formatBytes(stats.total_completed_bytes || 0);
        zipBtn.innerHTML = `
          ${icons.zip}
          <span>Descargar ZIP</span>
          <span class="zip-size-chip">${totalSize}</span>
        `;
        zipBtn.title = `Descargar ${stats.completed} ${stats.completed === 1 ? 'pista' : 'pistas'} en archivo .ZIP (${totalSize})`;
      }
    }

    const clearBtn = document.getElementById("btn-clear-completed");
    if (clearBtn) {
      clearBtn.style.display = (stats.completed > 0 || (stats.expired && stats.expired > 0)) ? "inline-flex" : "none";
    }
  },

  /**
   * Builds single preview card HTML string
   */
  createPreviewCardHtml(item, currentFormat = "mp3") {
    const isVideo = (item.format || currentFormat) === "mp4";
    const formatLabel = isVideo ? "MP4" : "MP3";
    const title = item.title || item.url;
    const artist = item.artist ? `${item.artist} &bull; ` : "";
    const durationHtml = item.duration_str
      ? `<span class="preview-duration-badge">${item.duration_str}</span>`
      : "";
    const thumbHtml = item.thumbnail
      ? `<img src="${item.thumbnail}" alt="" class="preview-thumb-img" loading="lazy">`
      : `<div style="color:var(--text-muted);">${isVideo ? icons.video : icons.music}</div>`;
    const formatBadge = `<span class="format-tag ${isVideo ? 'format-tag-mp4' : 'format-tag-mp3'}">${formatLabel}</span>`;

    return `
      <div class="preview-card" id="preview-card-${item.id}" data-id="${item.id}">
        <div class="preview-thumb-box">
          ${thumbHtml}
          ${durationHtml}
        </div>
        <div class="preview-info">
          <div class="preview-track-title" title="${title}">${title}</div>
          <div class="preview-track-meta">${artist}${formatBadge} <a href="${item.url}" target="_blank" rel="noopener noreferrer" style="color:var(--text-muted); text-decoration:none;">${item.url}</a></div>
        </div>
        <div class="preview-actions">
          <button type="button" class="btn btn-secondary btn-download-single-preview" data-id="${item.id}" style="padding: 5px 10px; font-size: 0.8rem;" title="Descargar solo este ${formatLabel}">
            ${icons.download} Descargar ${formatLabel}
          </button>
          <button type="button" class="btn-icon btn-icon-danger btn-remove-preview" data-id="${item.id}" title="Quitar de la lista de preparación">
            ${icons.trash}
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Renders the preview staging list
   */
  renderPreviewList(container, items, currentFormat = "mp3") {
    if (!items || items.length === 0) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = items.map((i) => this.createPreviewCardHtml(i, currentFormat)).join("");
  },

  /**
   * Updates UI state based on active cookies status
   */
  updateCookiesStatusUI(status) {
    const dot = document.getElementById("cookie-status-dot");
    const label = document.getElementById("cookie-btn-label");
    const badge = document.getElementById("cookie-modal-badge");
    const details = document.getElementById("cookie-modal-details");
    const deleteWrap = document.getElementById("cookie-delete-wrap");

    if (dot) {
      dot.classList.toggle("is-active", Boolean(status && status.has_cookies));
    }
    if (label) {
      label.textContent = status && status.has_cookies ? "Cookies activas" : "Cookies";
    }
    if (badge) {
      if (status && status.has_cookies) {
        badge.className = "status-badge badge-active";
        badge.textContent = "● Cookies activas";
      } else {
        badge.className = "status-badge badge-inactive";
        badge.textContent = "○ Sin cookies";
      }
    }
    if (details) {
      if (status && status.has_cookies) {
        details.textContent = `${status.size_str || ""} • ${status.valid_lines || 0} cookies cargadas`;
      } else {
        details.textContent = "Para videos con restricción de edad (+18)";
      }
    }
    if (deleteWrap) {
      deleteWrap.style.display = status && status.has_cookies ? "flex" : "none";
    }
  }
};
