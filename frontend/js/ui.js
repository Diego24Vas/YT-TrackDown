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
  youtube: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
  playlist: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15V6"/><path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path d="M12 12H3"/><path d="M16 6H3"/><path d="M12 18H3"/></svg>`,
  link: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,
  close: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  globe: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
  bell: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
  cookie: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none"></circle><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"></circle><circle cx="10" cy="16.5" r="1.1" fill="currentColor" stroke="none"></circle><circle cx="7" cy="13.5" r="1.1" fill="currentColor" stroke="none"></circle></svg>`,
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
   * Parses text and extracts valid http/https URLs, normalizing YouTube URLs and stripping punctuation
   */
  extractUrls(text) {
    if (!text) return [];
    // Pre-process: add https:// to bare youtube.com / youtu.be / www.youtube.com domains if missing protocol
    let processed = text.replace(/(^|[\s,;])((?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s,;"'<>()]+)/gi, "$1https://$2");
    
    // Match URLs starting with http:// or https://
    const rawMatches = processed.match(/https?:\/\/[^\s,;"'<>()]+/gi) || [];
    
    const cleaned = [];
    for (let u of rawMatches) {
      // Strip trailing punctuation like comma, period, bracket, quotes
      u = u.replace(/[.,;:!?)\]}>"']+$/g, "").trim();
      if (u && !cleaned.includes(u)) {
        cleaned.push(u);
      }
    }
    return cleaned;
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

    const isFetching = item.status === "fetching_info" || item.status === "queued";
    const thumbHtml = item.thumbnail
      ? `<img src="${item.thumbnail}" alt="" class="item-thumb-img" loading="lazy">`
      : `<div class="item-thumb-placeholder ${isFetching ? 'skeleton-shimmer' : ''}">${isVideo ? icons.video : icons.music}</div>`;

    const durationHtml = item.duration_str
      ? `<span class="item-duration-badge">${item.duration_str}</span>`
      : "";

    let progressFillClass = "";
    if (item.status === "converting") progressFillClass = "converting";
    if (item.status === "completed") progressFillClass = "completed";
    if (item.status === "expired") progressFillClass = "expired";
    if (item.status === "fetching_info") progressFillClass = "converting skeleton-shimmer";

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
   * Full render of list container with persistent pending skeletons
   */
  renderList(container, items, pendingCount = 0, currentFormat = "mp3") {
    if (!container) return;

    const hasRealItems = items && items.length > 0;
    const hasPendingSkeletons = pendingCount > 0;

    if (!hasRealItems && !hasPendingSkeletons) {
      container.querySelectorAll(".item-card-skeleton").forEach((el) => el.remove());
      container.innerHTML = `
        <div class="empty-queue">
          <div class="empty-icon">${icons.music}</div>
          <div class="empty-title">No hay descargas en esta vista</div>
          <div class="empty-desc">No se encontraron elementos correspondientes al filtro seleccionado.</div>
        </div>
      `;
      return;
    }

    // Clean up empty queue placeholder if present
    const emptyQueue = container.querySelector(".empty-queue");
    if (emptyQueue) emptyQueue.remove();

    // Render real items
    const realHtml = hasRealItems ? items.map((i) => this.createCardHtml(i)).join("") : "";
    container.innerHTML = realHtml;

    // Append pending skeleton cards below real items
    if (hasPendingSkeletons) {
      this.appendQueueLoading(container, pendingCount, currentFormat);
    }
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
        zipBtn.title = `Descargar ${stats.completed} ${stats.completed === 1 ? 'archivo' : 'archivos'} en archivo .ZIP (${totalSize})`;
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
    if (!container) return;
    if (!items || items.length === 0) {
      container.innerHTML = "";
      return;
    }

    // Always remove all skeleton loading cards before rendering or reconciling real cards
    container.querySelectorAll(".preview-card-skeleton").forEach((el) => el.remove());

    const currentFmtAttr = container.dataset.renderedFormat;
    if (currentFmtAttr !== currentFormat) {
      container.dataset.renderedFormat = currentFormat;
      container.innerHTML = items.map((i) => this.createPreviewCardHtml(i, currentFormat)).join("");
      return;
    }

    const itemIds = new Set(items.map((i) => i.id));
    // Remove cards no longer in items
    const existingCards = container.querySelectorAll(".preview-card:not(.preview-card-skeleton)");
    existingCards.forEach((card) => {
      const cardId = card.id ? card.id.replace("preview-card-", "") : null;
      if (cardId && !itemIds.has(cardId)) {
        card.remove();
      }
    });

    // Append new cards that don't exist yet
    items.forEach((item) => {
      const existing = document.getElementById(`preview-card-${item.id}`);
      if (!existing) {
        const temp = document.createElement("div");
        temp.innerHTML = this.createPreviewCardHtml(item, currentFormat).trim();
        if (temp.firstElementChild) {
          container.appendChild(temp.firstElementChild);
        }
      }
    });
  },

  /**
   * Appends skeleton card placeholders to an existing preview section
   */
  appendPreviewLoading(container, count = 1, currentFormat = "mp3") {
    if (!container) return;
    const isVideo = currentFormat === "mp4";
    const countClamped = Math.min(Math.max(count, 1), 5);

    let skeletonsHtml = "";
    for (let i = 0; i < countClamped; i++) {
      skeletonsHtml += `
        <div class="preview-card preview-card-skeleton" aria-hidden="true">
          <div class="preview-thumb-box skeleton-shimmer">
            <div class="skeleton-thumb-icon">${isVideo ? icons.video : icons.music}</div>
          </div>
          <div class="preview-info">
            <div class="skeleton-shimmer skeleton-line skeleton-line-title"></div>
            <div class="skeleton-shimmer skeleton-line skeleton-line-meta"></div>
          </div>
          <div class="preview-actions">
            <div class="skeleton-shimmer skeleton-btn-placeholder"></div>
            <div class="skeleton-shimmer skeleton-btn-icon-placeholder"></div>
          </div>
        </div>
      `;
    }

    container.insertAdjacentHTML("beforeend", skeletonsHtml);
  },

  /**
   * Renders sleek skeleton placeholders in the preview section while loading
   */
  renderPreviewLoading(container, count = 1, currentFormat = "mp3") {
    if (!container) return;
    container.innerHTML = "";
    this.appendPreviewLoading(container, count, currentFormat);
  },

  /**
   * Appends skeleton card placeholders to download queue while starting downloads
   */
  appendQueueLoading(container, count = 1, currentFormat = "mp3") {
    if (!container) return;
    const isVideo = currentFormat === "mp4";
    const countClamped = Math.min(Math.max(count, 1), 20);

    // Remove empty-queue state if present so skeleton cards display cleanly
    const emptyQueue = container.querySelector(".empty-queue");
    if (emptyQueue) emptyQueue.remove();

    let skeletonsHtml = "";
    for (let i = 0; i < countClamped; i++) {
      skeletonsHtml += `
        <div class="item-card item-card-skeleton" aria-hidden="true">
          <div class="item-thumb-box skeleton-shimmer">
            <div class="skeleton-thumb-icon">${isVideo ? icons.video : icons.music}</div>
          </div>
          <div class="item-content">
            <div class="item-header-row">
              <div style="min-width:0; flex:1;">
                <div class="skeleton-shimmer skeleton-line skeleton-line-title"></div>
                <div class="skeleton-shimmer skeleton-line skeleton-line-meta"></div>
              </div>
              <div class="item-status-wrapper">
                <div class="skeleton-shimmer skeleton-badge-placeholder"></div>
              </div>
            </div>
            <div class="progress-wrap" style="margin-top: 8px;">
              <div class="skeleton-shimmer skeleton-progress-placeholder"></div>
              <div class="progress-info-row tabular" style="margin-top: 4px;">
                <div class="skeleton-shimmer skeleton-line" style="width: 25%; height: 10px;"></div>
                <div class="skeleton-shimmer skeleton-line" style="width: 20%; height: 10px;"></div>
              </div>
            </div>
          </div>
          <div class="item-actions">
            <div class="skeleton-shimmer skeleton-btn-placeholder" style="width: 32px; height: 32px; border-radius: var(--radius-md);"></div>
          </div>
        </div>
      `;
    }

    container.insertAdjacentHTML("beforeend", skeletonsHtml);
  },

  /**
   * Renders skeleton placeholders in download queue
   */
  renderQueueLoading(container, count = 1, currentFormat = "mp3") {
    if (!container) return;
    container.innerHTML = "";
    this.appendQueueLoading(container, count, currentFormat);
  },

  /**
   * Detects platform from URL and returns appropriate icon, CSS class, and optional badge.
   * If the platform/logo is not recognized, returns the classic web globe icon ("el tipico mundito").
   */
  getUrlPlatformInfo(url) {
    if (!url) {
      return { icon: icons.globe, iconClass: "is-globe", badge: "" };
    }

    let hostname = "";
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      hostname = url.toLowerCase();
    }

    // YouTube (Video or Playlist)
    const isYouTube = hostname.includes("youtube.com") || hostname.includes("youtu.be");
    if (isYouTube) {
      const isPlaylist = url.includes("playlist?list=") || url.includes("&list=") || url.includes("list=PL");
      if (isPlaylist) {
        return { icon: icons.playlist, iconClass: "is-playlist", badge: "Playlist" };
      }
      return { icon: icons.youtube, iconClass: "is-youtube", badge: "" };
    }

    // SoundCloud
    if (hostname.includes("soundcloud.com")) {
      return { icon: icons.soundwave, iconClass: "is-soundcloud", badge: "SoundCloud" };
    }

    // Unrecognized / Generic page: classic globe icon ("el tipico mundito")
    return { icon: icons.globe, iconClass: "is-globe", badge: "" };
  },

  /**
   * Builds single rectangular link chip HTML string with remove button on right
   */
  createChipHtml(url, isLoading = false) {
    const info = this.getUrlPlatformInfo(url);
    const escapedUrl = url.replace(/"/g, "&quot;");
    const loadingClass = isLoading ? "is-loading" : "";

    return `
      <div class="composer-chip ${loadingClass}" data-url="${escapedUrl}" title="${escapedUrl}">
        <span class="composer-chip-icon ${info.iconClass}">
          ${isLoading ? icons.spinner : info.icon}
        </span>
        <span class="composer-chip-text" title="${escapedUrl}">
          ${escapedUrl}
        </span>
        ${info.badge ? `<span class="composer-chip-badge">${info.badge}</span>` : ""}
        <button type="button" class="composer-chip-remove" data-url="${escapedUrl}" title="Eliminar este enlace completo" aria-label="Eliminar enlace completo">
          ${icons.close}
        </button>
      </div>
    `;
  },

  /**
   * Renders rectangular chips in the composer tray
   */
  renderChips(container, urls, loadingUrls = []) {
    if (!container) return;
    if (!urls || urls.length === 0) {
      container.innerHTML = "";
      return;
    }
    const isArrayOrSet = Array.isArray(loadingUrls) || loadingUrls instanceof Set;
    container.innerHTML = urls.map((u) => {
      let isLoading = false;
      if (typeof loadingUrls === "boolean") {
        isLoading = loadingUrls;
      } else if (isArrayOrSet) {
        const list = Array.from(loadingUrls);
        isLoading = list.some((lu) => this.urlsMatch(lu, u));
      }
      return this.createChipHtml(u, isLoading);
    }).join("");
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
  },

  /**
   * Updates notification button state in header
   */
  updateNotificationUI(state) {
    const dot = document.getElementById("notif-status-dot");
    const label = document.getElementById("notif-btn-label");
    const btn = document.getElementById("btn-toggle-notifications");
    if (!dot || !label || !btn) return;

    dot.classList.remove("is-active", "is-denied");

    if (state === "granted") {
      dot.classList.add("is-active");
      label.textContent = "Notificaciones activas";
      btn.title = "Notificaciones de escritorio activadas. Haz clic para pausarlas.";
    } else if (state === "paused") {
      label.textContent = "Notificaciones en pausa";
      btn.title = "Notificaciones de escritorio pausadas. Haz clic para reanudarlas.";
    } else if (state === "denied") {
      dot.classList.add("is-denied");
      label.textContent = "Notif. bloqueadas";
      btn.title = "Las notificaciones están bloqueadas en tu navegador. Haz clic para ver cómo habilitarlas.";
    } else if (state === "unsupported") {
      label.textContent = "Notificaciones";
      btn.title = "Tu navegador no soporta notificaciones de escritorio.";
      btn.disabled = true;
    } else {
      // default / not requested yet
      label.textContent = "Notificaciones";
      btn.title = "Activar notificaciones de escritorio cuando finalicen descargas.";
    }
  }
};
