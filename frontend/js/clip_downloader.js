/**
 * Clip Downloader Module (Time-range Video and Audio Cutting)
 * Completely isolated from main YouTube downloader logic and HLS stream logic.
 * Features:
 * - Direct stream keyframe cutting without downloading entire video first
 * - Time format parsing (MM:SS, HH:MM:SS, and seconds)
 * - Interactive step chips (+10s, -10s, 00:00, video end)
 * - Real-time duration calculation and validation
 * - Independent queue with live SSE/polling progress and direct file download
 */

import { icons, ui } from "./ui.js?v=2.0.7";

class ClipDownloader {
  constructor() {
    this.pollTimer = null;
    this.tasks = [];
    this.currentFormat = "mp4";
    this.currentQuality = "1080";
    this.videoDuration = 0; // Duration in seconds of probed video
    this.lastProbedUrl = null;
    this.activeFilter = "all";
    this.isProbing = false;
    this.isSubmitting = false;

    this.audioQualities = [
      { value: "320", label: "320 kbps", badge: "Máxima" },
      { value: "256", label: "256 kbps", badge: "Alta" },
      { value: "192", label: "192 kbps", badge: "Estándar", isDefault: true },
      { value: "128", label: "128 kbps", badge: "Ligera" },
    ];

    this.videoQualities = [
      { value: "1080", label: "1080p", badge: "Full HD", isDefault: true },
      { value: "720", label: "720p", badge: "HD" },
      { value: "480", label: "480p", badge: "SD" },
      { value: "360", label: "360p", badge: "Ligero" },
      { value: "best", label: "Máxima", badge: "Original" },
    ];

    this.init();
  }

  init() {
    this.setupFormatTabs();
    this.setupQualitySelector();
    this.setupForm();
    this.setupTimeStepChips();
    this.setupFilterTabs();
    this.loadInitialTasks();
  }

  // Parses MM:SS, HH:MM:SS, or seconds string to numeric seconds
  parseTimeToSeconds(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return Math.max(0, val);
    const s = String(val).trim();
    if (!s) return 0;

    if (s.includes(":")) {
      const parts = s.split(":").map((p) => parseFloat(p) || 0);
      if (parts.length === 1) return parts[0];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length >= 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : Math.max(0, n);
  }

  // Formats seconds into MM:SS or HH:MM:SS string
  formatSecondsToTime(seconds) {
    if (!seconds || seconds <= 0) return "00:00";
    const total = Math.round(seconds);
    const m = Math.floor(total / 60) % 60;
    const s = total % 60;
    const h = Math.floor(total / 3600);

    const pad = (n) => String(n).padStart(2, "0");
    if (h > 0) {
      return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }
    return `${pad(m)}:${pad(s)}`;
  }

  // Human friendly duration (e.g. "2 min 15 s")
  formatFriendlyDuration(seconds) {
    if (!seconds || seconds <= 0) return "0 seg";
    const total = Math.round(seconds);
    const m = Math.floor(total / 60) % 60;
    const s = total % 60;
    const h = Math.floor(total / 3600);

    const parts = [];
    if (h > 0) parts.push(`${h} h`);
    if (m > 0) parts.push(`${m} min`);
    if (s > 0 || parts.length === 0) parts.push(`${s} seg`);
    return parts.join(" ");
  }

  // Format Switcher (MP3 / MP4)
  setupFormatTabs() {
    const tabMp3 = document.getElementById("clip-tab-mp3");
    const tabMp4 = document.getElementById("clip-tab-mp4");

    const setFormat = (fmt) => {
      this.currentFormat = fmt;
      if (tabMp3) tabMp3.classList.toggle("is-active", fmt === "mp3");
      if (tabMp4) tabMp4.classList.toggle("is-active", fmt === "mp4");

      const btnDownloadText = document.getElementById("clip-btn-download-text");
      if (btnDownloadText) {
        btnDownloadText.textContent = `Descargar Clip (${fmt.toUpperCase()})`;
      }

      this.updateQualityOptions();
    };

    if (tabMp3) tabMp3.addEventListener("click", () => setFormat("mp3"));
    if (tabMp4) tabMp4.addEventListener("click", () => setFormat("mp4"));
  }

  // Quality Selector
  setupQualitySelector() {
    const trigger = document.getElementById("clip-quality-trigger-btn");
    const menu = document.getElementById("clip-quality-options-menu");
    const wrap = document.getElementById("clip-quality-dropdown-wrap");

    if (!trigger || !menu || !wrap) return;

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.contains("is-open");
      menu.classList.toggle("is-open", !isOpen);
      trigger.setAttribute("aria-expanded", !isOpen ? "true" : "false");
    });

    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) {
        menu.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
      }
    });

    this.updateQualityOptions();
  }

  updateQualityOptions() {
    const menu = document.getElementById("clip-quality-options-menu");
    const currentLabel = document.getElementById("clip-quality-current-label");
    const currentBadge = document.getElementById("clip-quality-current-badge");
    const trigger = document.getElementById("clip-quality-trigger-btn");

    if (!menu) return;

    const isVideo = this.currentFormat === "mp4";
    const list = isVideo ? this.videoQualities : this.audioQualities;
    const defaultOpt = list.find((q) => q.isDefault) || list[0];

    // Find current or fallback
    const match = list.find((q) => q.value === this.currentQuality) || defaultOpt;
    this.currentQuality = match.value;

    if (currentLabel) currentLabel.textContent = match.label;
    if (currentBadge) currentBadge.textContent = match.badge;

    menu.innerHTML = `
      <div class="custom-select-header">
        <span>${isVideo ? "Resolución de Video" : "Calidad de Audio"}</span>
      </div>
      ${list
        .map(
          (q) => `
        <div class="custom-select-option ${q.value === this.currentQuality ? "is-selected" : ""}" data-value="${q.value}" role="option">
          <div class="option-content">
            <div class="option-title-row">
              <span class="option-title">${q.label}</span>
              <span class="option-badge">${q.badge}</span>
            </div>
          </div>
          <svg class="option-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      `
        )
        .join("")}
    `;

    menu.querySelectorAll(".custom-select-option").forEach((opt) => {
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        this.currentQuality = opt.dataset.value;
        const selectedInfo = list.find((q) => q.value === this.currentQuality);
        if (selectedInfo) {
          if (currentLabel) currentLabel.textContent = selectedInfo.label;
          if (currentBadge) currentBadge.textContent = selectedInfo.badge;
        }
        menu.classList.remove("is-open");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
        this.updateQualityOptions();
      });
    });
  }

  // Checks if text resembles a supported media URL
  isValidUrl(str) {
    if (!str) return false;
    const s = str.trim();
    return (
      s.startsWith("http://") ||
      s.startsWith("https://") ||
      s.includes("youtube.com/") ||
      s.includes("youtu.be/") ||
      s.includes("soundcloud.com/")
    );
  }

  // Form setup and event listeners
  setupForm() {
    const btnPaste = document.getElementById("clip-btn-paste");
    const btnResetForm = document.getElementById("clip-btn-reset-form");
    const urlInput = document.getElementById("clip-url");
    const btnProbe = document.getElementById("clip-btn-probe");
    const startInput = document.getElementById("clip-start-time");
    const endInput = document.getElementById("clip-end-time");
    const btnDownload = document.getElementById("clip-btn-download");
    const btnClearCompleted = document.getElementById("clip-btn-clear-completed");

    let probeDebounceTimer = null;

    const triggerAutoProbe = (immediate = false) => {
      if (probeDebounceTimer) {
        clearTimeout(probeDebounceTimer);
        probeDebounceTimer = null;
      }

      const val = urlInput?.value?.trim() || "";
      if (!val || !this.isValidUrl(val)) return;

      if (val === this.lastProbedUrl && !immediate) return;

      if (immediate) {
        this.handleProbe(true);
      } else {
        probeDebounceTimer = setTimeout(() => {
          this.handleProbe(false);
        }, 300);
      }
    };

    if (btnPaste && urlInput) {
      btnPaste.addEventListener("click", async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            urlInput.value = text.trim();
            triggerAutoProbe(true);
          }
        } catch {
          urlInput.focus();
        }
      });
    }

    if (btnProbe) {
      btnProbe.addEventListener("click", () => this.handleProbe(true));
    }

    if (urlInput) {
      // 1. Immediate trigger when pasting (Ctrl+V, context menu paste)
      urlInput.addEventListener("paste", (e) => {
        const pasted = (e.clipboardData || window.clipboardData)?.getData("text") || "";
        if (pasted && pasted.trim()) {
          setTimeout(() => triggerAutoProbe(true), 10);
        }
      });

      // 2. Drag & Drop URL
      urlInput.addEventListener("drop", (e) => {
        e.preventDefault();
        const text = e.dataTransfer?.getData("text") || "";
        if (text && text.trim()) {
          urlInput.value = text.trim();
          triggerAutoProbe(true);
        }
      });

      // 3. Automatic detection as the link is placed or typed
      urlInput.addEventListener("input", () => {
        triggerAutoProbe(false);
      });

      // 4. Enter key
      urlInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          triggerAutoProbe(true);
        }
      });

      // 5. Blur / change
      urlInput.addEventListener("change", () => {
        triggerAutoProbe(true);
      });
      urlInput.addEventListener("blur", () => {
        triggerAutoProbe(false);
      });
    }

    if (startInput) {
      startInput.addEventListener("input", () => this.validateAndCalcDuration());
      startInput.addEventListener("blur", () => {
        const sec = this.parseTimeToSeconds(startInput.value);
        startInput.value = this.formatSecondsToTime(sec);
        this.validateAndCalcDuration();
      });
    }

    if (endInput) {
      endInput.addEventListener("input", () => this.validateAndCalcDuration());
      endInput.addEventListener("blur", () => {
        const sec = this.parseTimeToSeconds(endInput.value);
        endInput.value = this.formatSecondsToTime(sec);
        this.validateAndCalcDuration();
      });
    }

    if (btnResetForm) {
      btnResetForm.addEventListener("click", () => this.resetForm());
    }

    if (btnDownload) {
      btnDownload.addEventListener("click", () => this.startDownload());
    }

    if (btnClearCompleted) {
      btnClearCompleted.addEventListener("click", () => this.clearCompletedTasks());
    }

    // Initial calculation
    this.validateAndCalcDuration();
  }

  // Resets all clip downloader form data
  resetForm() {
    const urlInput = document.getElementById("clip-url");
    const previewBox = document.getElementById("clip-video-preview");
    const previewImg = document.getElementById("clip-preview-img");
    const previewTitle = document.getElementById("clip-preview-title");
    const previewChannel = document.getElementById("clip-preview-channel");
    const previewDuration = document.getElementById("clip-preview-duration");
    const startInput = document.getElementById("clip-start-time");
    const endInput = document.getElementById("clip-end-time");
    const titleInput = document.getElementById("clip-title");
    const btnProbe = document.getElementById("clip-btn-probe");
    const durationTag = document.getElementById("clip-calc-duration");
    const valMsg = document.getElementById("clip-validation-msg");
    const btnDownload = document.getElementById("clip-btn-download");

    // 1. Reset URL Input
    if (urlInput) {
      urlInput.value = "";
      urlInput.classList.remove("is-invalid");
    }

    // 2. Hide and reset Staged Preview Box
    if (previewBox) {
      previewBox.style.display = "none";
    }
    if (previewImg) previewImg.src = "favicon.svg";
    if (previewTitle) previewTitle.textContent = "Cargando video...";
    if (previewChannel) previewChannel.textContent = "";
    if (previewDuration) previewDuration.textContent = "--:--";

    // 3. Reset Start and End Times
    if (startInput) {
      startInput.value = "00:00";
      startInput.classList.remove("is-invalid");
    }

    if (endInput) {
      endInput.value = "01:00";
      endInput.classList.remove("is-invalid");
    }

    // 4. Reset Custom Title
    if (titleInput) {
      titleInput.value = "";
    }

    // 5. Reset Probe Button State
    if (btnProbe) {
      btnProbe.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> <span>Verificar</span>`;
      btnProbe.disabled = false;
    }

    // 6. Reset Internal State
    this.videoDuration = 0;
    this.lastProbedUrl = "";
    this.isProbing = false;
    this.isSubmitting = false;

    // 7. Reset Duration Ribbon and Validation
    if (durationTag) {
      durationTag.textContent = "1 min 00 seg";
    }
    if (valMsg) {
      valMsg.textContent = "";
      valMsg.classList.remove("is-visible");
    }

    // 8. Re-enable Download Button
    if (btnDownload) {
      btnDownload.disabled = false;
      btnDownload.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="6" cy="6" r="3"></circle>
          <circle cx="6" cy="18" r="3"></circle>
          <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
          <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
          <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
        </svg>
        <span id="clip-btn-download-text">Descargar Clip (${this.currentFormat.toUpperCase()})</span>
      `;
    }

    this.validateAndCalcDuration();
    ui.showToast("Todos los datos han sido limpiados", "info", this.currentFormat);
    urlInput?.focus();
  }

  // Quick Action Buttons (+10s, -10s, 00:00, Fin)
  setupTimeStepChips() {
    const startInput = document.getElementById("clip-start-time");
    const endInput = document.getElementById("clip-end-time");

    document.querySelectorAll("[data-time-target]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const target = chip.dataset.timeTarget; // "start" or "end"
        const action = chip.dataset.timeAction; // "zero", "plus", "minus", "end"
        const amount = parseFloat(chip.dataset.timeAmount || 0);

        const input = target === "start" ? startInput : endInput;
        if (!input) return;

        let cur = this.parseTimeToSeconds(input.value);

        if (action === "zero") {
          cur = 0;
        } else if (action === "plus") {
          cur += amount;
        } else if (action === "minus") {
          cur = Math.max(0, cur - amount);
        } else if (action === "end") {
          cur = this.videoDuration > 0 ? this.videoDuration : Math.max(cur, 300);
        }

        input.value = this.formatSecondsToTime(cur);
        this.validateAndCalcDuration();
      });
    });
  }

  // Validate start/end times and update dynamic duration ribbon
  validateAndCalcDuration() {
    const startInput = document.getElementById("clip-start-time");
    const endInput = document.getElementById("clip-end-time");
    const durationTag = document.getElementById("clip-calc-duration");
    const valMsg = document.getElementById("clip-validation-msg");
    const btnDownload = document.getElementById("clip-btn-download");

    const st = this.parseTimeToSeconds(startInput?.value);
    const et = this.parseTimeToSeconds(endInput?.value);

    let isValid = true;
    let errorText = "";

    if (et <= st) {
      isValid = false;
      errorText = "El tiempo de fin debe ser mayor al de inicio";
      if (endInput) endInput.classList.add("is-invalid");
    } else {
      if (endInput) endInput.classList.remove("is-invalid");
    }

    if (isValid && this.videoDuration > 0 && et > this.videoDuration) {
      errorText = `Aviso: El fin supera la duración del video (${this.formatSecondsToTime(this.videoDuration)})`;
    }

    const durationSec = Math.max(0, et - st);
    if (durationTag) {
      durationTag.textContent = isValid ? this.formatFriendlyDuration(durationSec) : "0 seg";
    }

    if (valMsg) {
      if (errorText) {
        valMsg.textContent = errorText;
        valMsg.classList.add("is-visible");
      } else {
        valMsg.textContent = "";
        valMsg.classList.remove("is-visible");
      }
    }

    if (btnDownload) {
      btnDownload.disabled = !isValid || this.isSubmitting;
    }

    return isValid;
  }

  // Probe media URL to get thumbnail, duration, and title
  async handleProbe(forced = false) {
    const urlInput = document.getElementById("clip-url");
    const btnProbe = document.getElementById("clip-btn-probe");
    const previewBox = document.getElementById("clip-video-preview");
    const endInput = document.getElementById("clip-end-time");

    const url = urlInput?.value?.trim();
    if (!url) {
      if (forced) {
        ui.showToast("Ingresa un enlace de video para cortar el clip", "info", this.currentFormat);
        urlInput?.focus();
      }
      return;
    }

    if (!forced && url === this.lastProbedUrl) {
      return;
    }

    if (this.isProbing) return;
    this.isProbing = true;

    if (btnProbe) {
      btnProbe.disabled = true;
      btnProbe.innerHTML = `<span class="spinner-sm" style="display:inline-block;width:13px;height:13px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin 600ms linear infinite;vertical-align:middle;margin-right:4px;"></span> <span>Detectando...</span>`;
    }

    try {
      const resp = await fetch("/api/clips/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await resp.json();

      if (data.success) {
        this.lastProbedUrl = url;
        this.videoDuration = data.duration || 0;

        if (previewBox) {
          previewBox.style.display = "flex";
          document.getElementById("clip-preview-title").textContent = data.title || "Video";
          document.getElementById("clip-preview-channel").textContent = data.artist || "";
          document.getElementById("clip-preview-duration").textContent = data.duration_str || "00:00";

          const img = document.getElementById("clip-preview-img");
          if (img) {
            img.src = data.thumbnail || "favicon.svg";
          }
        }

        // Set smart default end time if needed
        if (endInput && this.videoDuration > 0) {
          const currentEnd = this.parseTimeToSeconds(endInput.value);
          if (currentEnd <= 0 || currentEnd === 60) {
            endInput.value = this.formatSecondsToTime(Math.min(60, this.videoDuration));
          }
        }

        this.validateAndCalcDuration();
        ui.showToast("Video detectado automáticamente", "success", this.currentFormat);

        if (btnProbe) {
          btnProbe.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Detectado</span>`;
          setTimeout(() => {
            if (btnProbe) {
              btnProbe.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> <span>Verificar</span>`;
            }
          }, 2500);
        }
      } else {
        if (forced) {
          ui.showToast(data.error_message || "No se pudo verificar el video", "error", this.currentFormat);
        }
        if (btnProbe) {
          btnProbe.textContent = "Verificar";
        }
      }
    } catch (err) {
      if (forced) {
        ui.showToast("Error de conexión al verificar el video", "error", this.currentFormat);
      }
      if (btnProbe) {
        btnProbe.textContent = "Verificar";
      }
    } finally {
      this.isProbing = false;
      if (btnProbe) {
        btnProbe.disabled = false;
      }
    }
  }

  // Starts the clip download
  async startDownload() {
    if (this.isSubmitting) return;
    if (!this.validateAndCalcDuration()) {
      ui.showToast("Revisa los tiempos de inicio y fin del clip", "error", this.currentFormat);
      return;
    }

    const urlInput = document.getElementById("clip-url");
    const startInput = document.getElementById("clip-start-time");
    const endInput = document.getElementById("clip-end-time");
    const titleInput = document.getElementById("clip-title");
    const btnDownload = document.getElementById("clip-btn-download");

    const url = urlInput?.value?.trim();
    if (!url) {
      ui.showToast("Por favor ingresa la URL del video", "error", this.currentFormat);
      urlInput?.focus();
      return;
    }

    const st = this.parseTimeToSeconds(startInput?.value);
    const et = this.parseTimeToSeconds(endInput?.value);
    const customTitle = titleInput?.value?.trim() || null;

    this.isSubmitting = true;
    if (btnDownload) {
      btnDownload.disabled = true;
      btnDownload.innerHTML = `<span class="spinner-sm" style="display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin 600ms linear infinite;margin-right:6px;"></span> Procesando clip...`;
    }

    try {
      const resp = await fetch("/api/clips/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          start_time: st,
          end_time: et,
          start_time_str: this.formatSecondsToTime(st),
          end_time_str: this.formatSecondsToTime(et),
          format: this.currentFormat,
          quality: this.currentQuality,
          custom_title: customTitle,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || "Error al iniciar la descarga del clip");
      }

      const item = await resp.json();
      ui.showToast("Corte de clip iniciado", "success", this.currentFormat);

      // Make queue visible & scroll to it
      const queueSection = document.getElementById("clip-queue-section");
      if (queueSection) {
        queueSection.style.display = "flex";
        queueSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      this.loadInitialTasks();
      this.startPolling();
    } catch (err) {
      ui.showToast(err.message, "error", this.currentFormat);
    } finally {
      this.isSubmitting = false;
      if (btnDownload) {
        btnDownload.disabled = false;
        btnDownload.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="6" cy="6" r="3"></circle>
            <circle cx="6" cy="18" r="3"></circle>
            <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
            <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
            <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
          </svg>
          <span id="clip-btn-download-text">Descargar Clip (${this.currentFormat.toUpperCase()})</span>
        `;
      }
    }
  }

  // Queue and polling management
  async loadInitialTasks() {
    try {
      const resp = await fetch("/api/clips/tasks");
      if (resp.ok) {
        this.tasks = await resp.json();
        this.renderTasks();

        const hasActive = this.tasks.some((t) =>
          ["queued", "probing", "downloading", "converting"].includes(t.status)
        );
        if (hasActive) {
          this.startPolling();
        }
      }
    } catch {
      // Non-blocking
    }
  }

  startPolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(async () => {
      try {
        const resp = await fetch("/api/clips/tasks");
        if (resp.ok) {
          this.tasks = await resp.json();
          this.renderTasks();

          const hasActive = this.tasks.some((t) =>
            ["queued", "probing", "downloading", "converting"].includes(t.status)
          );
          if (!hasActive) {
            this.stopPolling();
          }
        }
      } catch {
        // Retry next interval
      }
    }, 300);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  refreshTasks() {
    this.loadInitialTasks();
  }

  setupFilterTabs() {
    const tabs = document.querySelectorAll("#clip-filter-tabs .filter-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        this.activeFilter = tab.dataset.filter || "all";
        this.renderTasks();
      });
    });
  }

  renderTasks() {
    const queueSection = document.getElementById("clip-queue-section");
    const queueList = document.getElementById("clip-queue-list");
    const queueCounter = document.getElementById("clip-queue-counter");
    const btnClearCompleted = document.getElementById("clip-btn-clear-completed");

    if (!queueList) return;

    if (this.tasks.length === 0) {
      if (queueSection) queueSection.style.display = "none";
      return;
    }

    if (queueSection) queueSection.style.display = "flex";

    // Filter tasks
    const filtered = this.tasks.filter((t) => {
      if (this.activeFilter === "downloading") {
        return ["queued", "probing", "downloading", "converting"].includes(t.status);
      }
      if (this.activeFilter === "completed") return t.status === "completed";
      if (this.activeFilter === "error") return t.status === "error";
      return true;
    });

    const completedCount = this.tasks.filter((t) => t.status === "completed").length;
    if (queueCounter) {
      queueCounter.textContent = `${completedCount}/${this.tasks.length}`;
    }

    if (btnClearCompleted) {
      btnClearCompleted.style.display = completedCount > 0 ? "inline-flex" : "none";
    }

    if (filtered.length === 0) {
      queueList.innerHTML = `
        <div class="empty-queue" style="padding: 24px 0; text-align: center; color: var(--text-muted);">
          No hay clips en este filtro
        </div>
      `;
      return;
    }

    queueList.innerHTML = filtered
      .map((t) => this.renderTaskItemHtml(t))
      .join("");

    // Attach actions
    filtered.forEach((t) => {
      const btnDelete = document.getElementById(`btn-del-clip-${t.id}`);
      if (btnDelete) {
        btnDelete.addEventListener("click", () => this.deleteTask(t.id));
      }

      const btnDownloadFile = document.getElementById(`btn-dl-clip-${t.id}`);
      if (btnDownloadFile) {
        btnDownloadFile.addEventListener("click", () => {
          window.location.href = `/api/clips/tasks/${t.id}/file`;
        });
      }
    });
  }

  renderTaskItemHtml(t) {
    const isCompleted = t.status === "completed";
    const isError = t.status === "error";
    const isConverting = t.status === "converting";
    const isDownloading = t.status === "downloading";
    const isQueued = t.status === "queued";

    const isVideo = t.format === "mp4";
    const formatLabel = isVideo ? "MP4" : "MP3";
    const qualityText = isVideo
      ? (t.quality === "best" ? "Máx" : `${t.quality}p`)
      : `${t.quality}kbps`;

    const formatBadge = isVideo
      ? `<span class="format-tag format-tag-mp4">MP4 ${qualityText}</span>`
      : `<span class="format-tag format-tag-mp3">MP3 ${qualityText}</span>`;

    const pct = t.progress?.percentage || (isCompleted ? 100 : 0);
    const rangeTag = `${t.start_time_str || "00:00"} - ${t.end_time_str || "Fin"}`;
    const displayDuration = t.clip_duration_str ? `${t.clip_duration_str}` : rangeTag;

    let statusBadge = "";
    if (isCompleted) {
      statusBadge = `<span class="status-badge badge-completed">${icons.check} Completado</span>`;
    } else if (isError) {
      statusBadge = `<span class="status-badge badge-error">${icons.alert} Error</span>`;
    } else if (isConverting) {
      statusBadge = `<span class="status-badge badge-converting">${isVideo ? icons.video : icons.soundwave} Procesando clip</span>`;
    } else if (isDownloading) {
      statusBadge = `<span class="status-badge badge-downloading tabular">${icons.spinner} Cortando ${pct.toFixed(0)}%</span>`;
    } else {
      statusBadge = `<span class="status-badge badge-queued">${icons.clock} En espera</span>`;
    }

    let progressFillClass = "";
    if (isConverting) progressFillClass = "converting";
    if (isCompleted) progressFillClass = "completed";

    let leftStatus = "";
    let rightStatus = "";
    if (isCompleted) {
      leftStatus = "Listo para guardar en tu equipo";
      rightStatus = t.file_size_str ? `Peso final: ${t.file_size_str}` : "";
    } else if (isConverting) {
      leftStatus = t.progress?.speed_str || "Ensamblando pistas y formato...";
      rightStatus = t.file_size_str || "";
    } else if (isDownloading) {
      leftStatus = t.progress?.speed_str || "Descargando stream...";
      rightStatus = (t.progress?.eta_str ? `ETA: ${t.progress.eta_str} • ` : "") + (t.file_size_str || "");
    } else {
      leftStatus = "En cola de espera...";
      rightStatus = "";
    }

    const title = t.title || "Clip de video";
    const artist = t.artist ? `${t.artist} • ` : "";

    const sizeBadge = t.file_size_str
      ? `<span class="item-size-badge" title="Peso del clip">${t.file_size_str}</span>`
      : "";

    const errorHtml = t.error_message
      ? `<div class="item-error-msg">${t.error_message}</div>`
      : "";

    let actionBtnHtml = "";
    if (isCompleted) {
      const ext = isVideo ? ".mp4" : ".mp3";
      const cleanTitle = (t.title || "clip").replace(/[\\/*?:"<>|]/g, "").trim();
      const downloadName = cleanTitle.toLowerCase().endsWith(ext) ? cleanTitle : `${cleanTitle}${ext}`;
      actionBtnHtml = `
        <a href="/api/clips/tasks/${t.id}/file" download="${downloadName.replace(/"/g, '&quot;')}" class="btn btn-success" style="padding: 6px 12px; font-size: 0.82rem;" title="Guardar archivo ${formatLabel}">
          ${icons.download} Guardar ${formatLabel}
        </a>
      `;
    }

    return `
      <div class="item-card clip-card-item" id="clip-card-${t.id}" data-id="${t.id}" data-status="${t.status}">
        <div class="item-thumb-box">
          <img src="${t.thumbnail || "favicon.svg"}" alt="" class="item-thumb-img" loading="lazy" />
          <span class="item-duration-badge" title="Duración del clip">${displayDuration}</span>
        </div>

        <div class="item-content">
          <div class="item-header-row">
            <div style="min-width: 0; flex: 1;">
              <div class="item-title" title="${title}">${title}</div>
              <div class="item-meta-row">
                <span>${artist}${formatBadge}</span>
                <span class="clip-range-pill" title="Intervalo del corte">
                  ${icons.clock} ${rangeTag}
                </span>
                ${sizeBadge}
                ${t.url ? `
                  <a href="${t.url}" target="_blank" rel="noopener noreferrer" style="color:var(--text-muted); display:inline-flex; align-items:center; gap:2px;" title="Abrir enlace original">
                    ${icons.externalLink}
                  </a>
                ` : ""}
              </div>
            </div>
            <div id="clip-status-badge-${t.id}" class="item-status-wrapper">
              ${statusBadge}
            </div>
          </div>

          <!-- Progress Track & Info Row -->
          <div class="progress-wrap">
            <div class="progress-track">
              <div class="progress-fill ${progressFillClass}" id="clip-progress-fill-${t.id}" style="width: ${pct}%;"></div>
            </div>
            <div class="progress-info-row tabular" id="clip-progress-info-${t.id}">
              <span>${leftStatus}</span>
              <span>${rightStatus}</span>
            </div>
          </div>

          ${errorHtml}
        </div>

        <div class="item-actions">
          <div id="clip-action-slot-${t.id}" class="item-action-slot">
            ${actionBtnHtml}
          </div>
          <button type="button" class="btn-icon btn-icon-danger btn-delete" id="btn-del-clip-${t.id}" title="Eliminar clip">
            ${icons.trash}
          </button>
        </div>
      </div>
    `;
  }

  async deleteTask(taskId) {
    try {
      const resp = await fetch(`/api/clips/tasks/${taskId}`, { method: "DELETE" });
      if (resp.ok) {
        this.tasks = this.tasks.filter((t) => t.id !== taskId);
        this.renderTasks();
      }
    } catch {
      // Non-blocking
    }
  }

  async clearCompletedTasks() {
    try {
      const resp = await fetch("/api/clips/clear-completed", { method: "POST" });
      if (resp.ok) {
        this.tasks = this.tasks.filter((t) => !["completed", "error"].includes(t.status));
        this.renderTasks();
      }
    } catch {
      // Non-blocking
    }
  }
}

// Instantiate and expose globally
window.clipDownloader = new ClipDownloader();
export { ClipDownloader };
