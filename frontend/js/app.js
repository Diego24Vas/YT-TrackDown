import { api } from "./api.js?v=1.7.0";
import { store } from "./store.js?v=1.7.0";
import { ui, icons } from "./ui.js?v=1.7.0";

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const composerTextarea = document.getElementById("composer-textarea");
  const composerInput = document.getElementById("composer-input");
  const composerChipsWrap = document.getElementById("composer-chips-wrap");
  const inputComposer = document.getElementById("input-composer");
  const composerTray = document.getElementById("composer-tray");
  const linkCounterChip = document.getElementById("link-counter-chip");
  const btnPaste = document.getElementById("btn-paste-clipboard");
  const btnClearComposer = document.getElementById("btn-clear-composer");
  const selectQuality = document.getElementById("select-quality");
  const queueList = document.getElementById("queue-list");
  const queueSection = document.getElementById("queue-section");
  const connectionDot = document.getElementById("connection-dot");
  const filterTabs = document.querySelectorAll(".filter-tab");
  const btnDownloadZip = document.getElementById("btn-download-zip");
  const btnClearCompleted = document.getElementById("btn-clear-completed");
  const btnToggleNotifications = document.getElementById("btn-toggle-notifications");

  // Preview elements
  const previewSection = document.getElementById("preview-section");
  const previewList = document.getElementById("preview-list");
  const previewCounter = document.getElementById("preview-counter");
  const previewBtnCount = document.getElementById("preview-btn-count");
  const btnClearPreview = document.getElementById("btn-clear-preview");
  const btnDownloadAllPreview = document.getElementById("btn-download-all-preview");

  // Format and Quality Definitions (separate for audio and video)
  let currentFormat = "mp3";

  const audioQualities = [
    { value: "320", label: "320 kbps", badge: "Máxima", badgeClass: "badge-max", desc: "Mayor fidelidad de audio" },
    { value: "256", label: "256 kbps", badge: "Alta", badgeClass: "badge-high", desc: "Excelente claridad y balance" },
    { value: "192", label: "192 kbps", badge: "Estándar", badgeClass: "badge-std", desc: "Rápido, recomendado para todo uso", isDefault: true },
    { value: "128", label: "128 kbps", badge: "Ligera", badgeClass: "badge-light", desc: "Descarga rápida, archivo liviano" },
  ];

  const videoQualities = [
    { value: "1080", label: "1080p", badge: "Full HD", badgeClass: "badge-max", desc: "Gran definición y detalle", isDefault: true },
    { value: "720", label: "720p", badge: "HD", badgeClass: "badge-high", desc: "Balance ideal calidad y peso" },
    { value: "480", label: "480p", badge: "SD", badgeClass: "badge-std", desc: "Definición estándar liviana" },
    { value: "360", label: "360p", badge: "Ligero", badgeClass: "badge-light", desc: "Descarga rápida, menor peso" },
    { value: "best", label: "Máxima", badge: "Original", badgeClass: "badge-max", desc: "Mejor resolución disponible en YouTube" },
  ];

  // Updates preview section title and icon based on format and staged count
  const updatePreviewHeader = () => {
    const previewItems = store.getPreviewItems();
    const count = previewItems.length;
    const isVideo = currentFormat === "mp4";
    const titleIcon = document.getElementById("preview-title-icon");
    const titleText = document.getElementById("preview-title-text");

    if (titleIcon) {
      titleIcon.innerHTML = isVideo ? icons.video : icons.music;
    }
    if (titleText) {
      if (isVideo) {
        titleText.textContent = count === 1 ? "Video preparado" : "Videos preparados";
      } else {
        titleText.textContent = count === 1 ? "Pista preparada" : "Pistas preparadas";
      }
    }
  };

  // Custom styled quality dropdown & format switcher logic
  const setupCustomQualitySelect = () => {
    const wrap = document.getElementById("quality-dropdown-wrap");
    const trigger = document.getElementById("quality-trigger-btn");
    const menu = document.getElementById("quality-options-menu");
    const currentLabel = document.getElementById("quality-current-label");
    const currentBadge = document.getElementById("quality-current-badge");
    const mainTabMp3 = document.getElementById("main-tab-mp3");
    const mainTabMp4 = document.getElementById("main-tab-mp4");
    const previewBtnFormat = document.getElementById("preview-btn-format");

    if (!wrap || !trigger || !menu || !selectQuality) return;

    const updateTriggerUI = (val) => {
      const isVideo = currentFormat === "mp4";
      const list = isVideo ? videoQualities : audioQualities;
      const info = list.find((q) => q.value === val) || { label: val, badge: "", badgeClass: "" };

      if (currentLabel) currentLabel.textContent = info.label;
      if (currentBadge) {
        currentBadge.textContent = info.badge;
        currentBadge.className = `custom-select-badge ${info.badgeClass || ""}`;
      }

      const options = menu.querySelectorAll(".custom-select-option");
      options.forEach((opt) => {
        const isMatch = opt.dataset.value === val;
        opt.classList.toggle("is-selected", isMatch);
        opt.setAttribute("aria-selected", isMatch ? "true" : "false");
      });
    };

    const attachOptionEvents = () => {
      const options = menu.querySelectorAll(".custom-select-option");
      options.forEach((opt) => {
        opt.addEventListener("click", (e) => {
          e.stopPropagation();
          const val = opt.dataset.value;
          if (val) {
            selectQuality.value = val;
            selectQuality.dispatchEvent(new Event("change"));
            updateTriggerUI(val);
            closeMenu();
          }
        });
      });
    };

    const renderMenuOptions = (format) => {
      const isVideo = format === "mp4";
      const list = isVideo ? videoQualities : audioQualities;
      const defaultOption = list.find((q) => q.isDefault) || list[0];
      const headerText = isVideo ? "Resolución de video" : "Tasa de bits (Bitrate)";

      // Rebuild hidden select options
      selectQuality.innerHTML = list
        .map((q) => `<option value="${q.value}" ${q.value === defaultOption.value ? "selected" : ""}>${q.label}</option>`)
        .join("");
      selectQuality.value = defaultOption.value;

      // Rebuild custom menu items
      menu.innerHTML = `
        <div class="custom-select-header">
          <span>${headerText}</span>
        </div>
        ${list
          .map(
            (q) => `
          <div class="custom-select-option ${q.value === defaultOption.value ? "is-selected" : ""}" data-value="${q.value}" role="option" aria-selected="${q.value === defaultOption.value ? "true" : "false"}">
            <div class="option-content">
              <div class="option-title-row">
                <span class="option-title">${q.label}</span>
                <span class="option-badge ${q.badgeClass}">${q.badge}</span>
              </div>
              <div class="option-desc">${q.desc}</div>
            </div>
            <svg class="option-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        `
          )
          .join("")}
      `;

      updateTriggerUI(defaultOption.value);
      attachOptionEvents();
    };

    const openMenu = () => {
      menu.classList.add("is-open");
      trigger.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
    };

    const closeMenu = () => {
      menu.classList.remove("is-open");
      trigger.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    };

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (menu.classList.contains("is-open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Close on click outside
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) {
        closeMenu();
      }
    });

    // Close on escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("is-open")) {
        closeMenu();
        trigger.focus();
      }
    });

    // Switch format handler - synchronizes all format UI elements
    const switchFormat = (format) => {
      if (currentFormat === format) return;
      currentFormat = format;

      // Synchronize top mode tabs
      if (mainTabMp3) mainTabMp3.classList.toggle("is-active", format === "mp3");
      if (mainTabMp4) mainTabMp4.classList.toggle("is-active", format === "mp4");

      // Update preview download button label
      if (previewBtnFormat) {
        previewBtnFormat.textContent = format.toUpperCase();
      }

      // Update preview section title and icon
      updatePreviewHeader();

      // Update quality options for this format
      renderMenuOptions(format);

      // Re-render preview cards if any exist so badges and buttons reflect the new format
      const previewItems = store.getPreviewItems();
      if (previewItems.length > 0 && previewList) {
        ui.renderPreviewList(previewList, previewItems, currentFormat);
      } else if (isPreviewLoading && previewList) {
        ui.renderPreviewLoading(previewList, activeUrls.length, currentFormat);
      }
    };

    if (mainTabMp3) mainTabMp3.addEventListener("click", () => switchFormat("mp3"));
    if (mainTabMp4) mainTabMp4.addEventListener("click", () => switchFormat("mp4"));

    // Initial render
    renderMenuOptions("mp3");
  };

  setupCustomQualitySelect();

  // Active URLs state for composer tray
  let activeUrls = [];

  // Helper to smoothly animate and dismiss the preview section
  let dismissTimeout = null;

  const cancelDismissPreview = () => {
    if (dismissTimeout) {
      clearTimeout(dismissTimeout);
      dismissTimeout = null;
    }
    if (previewSection) {
      previewSection.classList.remove("is-collapsing");
      previewSection.classList.remove("fade-out");
      previewSection.style.maxHeight = "";
      previewSection.style.marginBottom = "";
    }
  };

  const dismissPreviewSection = (callback) => {
    if (!previewSection || previewSection.style.display === "none") {
      if (callback) callback();
      return;
    }
    if (previewSection.classList.contains("is-collapsing")) {
      return;
    }

    if (dismissTimeout) {
      clearTimeout(dismissTimeout);
      dismissTimeout = null;
    }

    // Capture current height so CSS transitions max-height, padding, and margin seamlessly to 0
    const currentHeight = previewSection.offsetHeight;
    previewSection.style.maxHeight = `${currentHeight}px`;
    void previewSection.offsetHeight; // Force reflow

    previewSection.classList.add("is-collapsing");

    // Wait until transition fully finishes (350ms >= 340ms transition duration)
    dismissTimeout = setTimeout(() => {
      dismissTimeout = null;
      previewSection.style.display = "none";
      previewSection.classList.remove("is-collapsing");
      previewSection.style.maxHeight = "";
      previewSection.style.marginBottom = "";
      previewList.innerHTML = "";
      if (callback) callback();
    }, 350);
  };

  // Renders rectangular chips in the composer tray
  const renderChips = (loadingUrls = []) => {
    if (!composerChipsWrap) return;
    ui.renderChips(composerChipsWrap, activeUrls, loadingUrls);
  };

  // Synchronize active URLs state with UI, counters, and hidden textarea
  const syncUrlsToUI = (syncPreview = false) => {
    const count = activeUrls.length;
    const hasPlaylist = activeUrls.some(
      (u) => u.includes("playlist?list=") || u.includes("&list=") || u.includes("list=PL")
    );

    // Sync hidden textarea for compatibility
    if (composerTextarea) {
      composerTextarea.value = activeUrls.join("\n");
    }

    // Toggle clear composer button
    const hasInputText = composerInput && composerInput.value.trim().length > 0;
    if (btnClearComposer) {
      btnClearComposer.style.display = (count > 0 || hasInputText) ? "inline-flex" : "none";
    }

    // Update input placeholder based on tray contents
    if (composerInput) {
      composerInput.placeholder = count > 0
        ? "+ Agregar otro enlace (o pega aquí)..."
        : "Pega aquí tus enlaces (uno por línea o separados por espacio) o escribe y presiona Enter";
    }

    // Update link counter chip
    if (linkCounterChip) {
      if (count > 0) {
        if (hasPlaylist) {
          linkCounterChip.innerHTML = `<span style="color:var(--accent-amber); font-weight:600; display:inline-flex; align-items:center; gap:4px;">${icons.playlist} Playlist</span> &bull; ${count} ${count === 1 ? "enlace" : "enlaces"}`;
        } else {
          linkCounterChip.textContent = `${count} ${count === 1 ? "enlace" : "enlaces"}`;
        }
        linkCounterChip.classList.add("has-links");
      } else {
        linkCounterChip.textContent = "0 enlaces";
        linkCounterChip.classList.remove("has-links");
      }
    }

    // Synchronize preview in real time if requested
    if (syncPreview) {
      if (count === 0) {
        store.clearPreview();
        dismissPreviewSection();
      } else {
        const previewItems = store.getPreviewItems();
        if (previewItems.length > 0) {
          for (const item of previewItems) {
            const stillPresent = ui.itemMatchesUrlList(item, activeUrls);
            if (!stillPresent) {
              store.removePreviewItem(item.id);
            }
          }
        }
      }
    }
  };

  // Helper to fetch preview and stage items incrementally without downloading yet
  let pendingPreviewUrls = [];
  let isPreviewLoading = false;

  const processPreviewQueue = async () => {
    if (isPreviewLoading || pendingPreviewUrls.length === 0) return;
    cancelDismissPreview();
    isPreviewLoading = true;

    // Pop the current batch of URLs to fetch
    const urlsToFetch = [...pendingPreviewUrls];
    pendingPreviewUrls = [];

    // Mark ONLY the newly added URLs as loading in the chips tray
    renderChips(urlsToFetch);

    if (linkCounterChip) {
      const count = urlsToFetch.length;
      linkCounterChip.innerHTML = `${icons.spinner} Inspeccionando ${count === 1 ? "nuevo enlace" : count + " nuevos enlaces"}...`;
      linkCounterChip.classList.add("has-links");
    }

    // Immediately display preview section with loading skeleton for ONLY the new items
    if (previewSection && previewList) {
      cancelDismissPreview();
      previewSection.style.display = "flex";

      const existingItems = store.getPreviewItems();
      if (existingItems.length === 0) {
        ui.renderPreviewLoading(previewList, urlsToFetch.length, currentFormat);
      } else {
        // Keep existing rendered cards intact! Remove residual skeletons if any, and append new skeletons
        previewList.querySelectorAll(".preview-card-skeleton").forEach((el) => el.remove());
        ui.appendPreviewLoading(previewList, urlsToFetch.length, currentFormat);
      }

      const totalAnticipated = existingItems.length + urlsToFetch.length;
      if (previewCounter) previewCounter.textContent = `${totalAnticipated}`;
      if (previewBtnCount) previewBtnCount.textContent = `${totalAnticipated}`;
      updatePreviewHeader();

      // Disable preview download button while loading new batch
      if (btnDownloadAllPreview) {
        btnDownloadAllPreview.setAttribute("disabled", "true");
        btnDownloadAllPreview.style.opacity = "0.5";
        btnDownloadAllPreview.style.pointerEvents = "none";
      }
    }

    try {
      const res = await api.getPreview(urlsToFetch);
      // Clean up all skeleton placeholders as soon as the response arrives
      if (previewList) {
        previewList.querySelectorAll(".preview-card-skeleton").forEach((el) => el.remove());
      }

      if (res.items && res.items.length > 0) {
        // Add new items to store (preserving existing previsualized items)
        store.addPreviewItems(res.items);

        const entityLabel = currentFormat === "mp4"
          ? (res.count === 1 ? "video" : "videos")
          : (res.count === 1 ? "pista" : "pistas");
        ui.showToast(
          `Se ${res.count === 1 ? "preparó 1 " + entityLabel : "prepararon " + res.count + " " + entityLabel} en la lista inferior.`,
          "success"
        );
      } else {
        if (previewList) {
          previewList.querySelectorAll(".preview-card-skeleton").forEach((el) => el.remove());
        }
        if (store.getPreviewItems().length === 0) {
          dismissPreviewSection(() => store.clearPreview());
        }
      }
    } catch (err) {
      ui.showToast(err.message, "error");
      if (previewList) {
        previewList.querySelectorAll(".preview-card-skeleton").forEach((el) => el.remove());
      }
      if (store.getPreviewItems().length === 0) {
        dismissPreviewSection(() => store.clearPreview());
      }
    } finally {
      isPreviewLoading = false;
      renderChips(); // Clear loading spinners on chips
      syncUrlsToUI(false);
      if (btnDownloadAllPreview) {
        btnDownloadAllPreview.removeAttribute("disabled");
        btnDownloadAllPreview.style.opacity = "";
        btnDownloadAllPreview.style.pointerEvents = "";
      }

      // If more URLs arrived while this batch was processing, continue next batch immediately
      if (pendingPreviewUrls.length > 0) {
        processPreviewQueue();
      }
    }
  };

  const handlePreview = (urls) => {
    if (!urls || urls.length === 0) return;
    cancelDismissPreview();
    const currentPreviewItems = store.getPreviewItems();

    // Filter to only URLs that are NOT already in the store preview list and NOT already pending
    const urlsToFetch = urls.filter((u) => {
      const trimmed = u.trim();
      if (!trimmed) return false;
      const alreadyPreviewed = currentPreviewItems.some((item) => ui.itemMatchesUrlList(item, [trimmed]));
      const alreadyPending = pendingPreviewUrls.some((p) => ui.urlsMatch(p, trimmed));
      return !alreadyPreviewed && !alreadyPending;
    });

    if (urlsToFetch.length === 0) {
      syncUrlsToUI(false);
      return;
    }

    pendingPreviewUrls.push(...urlsToFetch);
    processPreviewQueue();
  };

  // Adds URLs to tray as rectangular chips
  const addUrls = (newUrls, triggerPreview = true) => {
    if (!newUrls || newUrls.length === 0) return 0;

    let addedCount = 0;
    for (const rawUrl of newUrls) {
      const u = rawUrl.trim();
      if (!u) continue;

      const exists = activeUrls.some((existing) => ui.urlsMatch(existing, u));
      if (exists) {
        // Flash existing chip in tray
        if (composerChipsWrap) {
          const chips = Array.from(composerChipsWrap.querySelectorAll(".composer-chip"));
          const chipEl = chips.find((el) => ui.urlsMatch(el.dataset.url, u));
          if (chipEl) {
            chipEl.classList.remove("is-duplicate-flash");
            void chipEl.offsetWidth; // Force reflow
            chipEl.classList.add("is-duplicate-flash");
          }
        }
        ui.showToast("Este enlace ya está en la bandeja", "info");
      } else {
        activeUrls.push(u);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      renderChips();
      syncUrlsToUI(false);
      if (triggerPreview) {
        handlePreview(activeUrls);
      }
    }

    return addedCount;
  };

  // Removes a single URL and its rectangular chip completely
  const removeUrl = (urlToRemove) => {
    if (composerChipsWrap) {
      const chips = Array.from(composerChipsWrap.querySelectorAll(".composer-chip"));
      const chipEl = chips.find((el) => ui.urlsMatch(el.dataset.url, urlToRemove));
      if (chipEl) {
        chipEl.classList.add("is-removing");
      }
    }

    pendingPreviewUrls = pendingPreviewUrls.filter((u) => !ui.urlsMatch(u, urlToRemove));

    setTimeout(() => {
      activeUrls = activeUrls.filter((u) => !ui.urlsMatch(u, urlToRemove));
      renderChips();
      syncUrlsToUI(true);
      ui.showToast("Enlace eliminado de la bandeja", "info");
    }, 140);
  };

  // Clears all chips and input from the tray completely with smooth coordinated exit
  const clearTray = () => {
    cancelDismissPreview();
    pendingPreviewUrls = [];
    if (composerInput) composerInput.value = "";

    // Animate chips out smoothly if present
    if (composerChipsWrap) {
      const chips = composerChipsWrap.querySelectorAll(".composer-chip");
      chips.forEach((c) => c.classList.add("is-removing"));
    }

    activeUrls = [];
    store.clearPreview();

    dismissPreviewSection(() => {
      renderChips();
      syncUrlsToUI(false);
    });

    // Clean up chip DOM after exit animation
    setTimeout(() => {
      renderChips();
      syncUrlsToUI(false);
    }, 180);
  };

  // Click on 'X' button to remove link chip completely
  if (composerChipsWrap) {
    composerChipsWrap.addEventListener("click", (e) => {
      const removeBtn = e.target.closest(".composer-chip-remove");
      if (removeBtn) {
        e.stopPropagation();
        const url = removeBtn.dataset.url;
        if (url) {
          removeUrl(url);
        }
      }
    });
  }

  // Click anywhere in composer tray focuses input
  if (composerTray) {
    composerTray.addEventListener("click", (e) => {
      if (!e.target.closest(".composer-chip") && composerInput) {
        composerInput.focus();
      }
    });
  }

  // Input typing and key shortcuts
  if (composerInput) {
    composerInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const val = composerInput.value.trim();
        if (val) {
          const urls = ui.extractUrls(val);
          if (urls.length > 0) {
            addUrls(urls, true);
            composerInput.value = "";
          } else {
            // Animate shake and feedback if not a valid URL
            composerInput.classList.add("input-shake");
            setTimeout(() => composerInput.classList.remove("input-shake"), 350);
            ui.showToast("Ingresa un enlace válido (ej. https://...)", "error");
          }
        } else if (store.getPreviewItems().length > 0) {
          if (isPreviewLoading) {
            ui.showToast("Inspeccionando enlaces, un momento...", "info");
          } else if (btnDownloadAllPreview && !btnDownloadAllPreview.hasAttribute("disabled")) {
            btnDownloadAllPreview.click();
          }
        } else if (activeUrls.length > 0) {
          handlePreview(activeUrls);
        }
      } else if (e.key === " " || e.key === ",") {
        const val = composerInput.value.trim();
        if (val) {
          const urls = ui.extractUrls(val);
          if (urls.length > 0) {
            e.preventDefault();
            addUrls(urls, true);
            composerInput.value = "";
          }
        }
      } else if (e.key === "Backspace" && composerInput.value === "" && activeUrls.length > 0) {
        // Backspace on empty input deletes the last rectangular chip
        const lastUrl = activeUrls[activeUrls.length - 1];
        removeUrl(lastUrl);
      }
    });

    composerInput.addEventListener("input", () => {
      if (btnClearComposer) {
        const hasText = composerInput.value.trim().length > 0;
        btnClearComposer.style.display = (activeUrls.length > 0 || hasText) ? "inline-flex" : "none";
      }
    });

    composerInput.addEventListener("blur", () => {
      const val = composerInput.value.trim();
      if (val) {
        const urls = ui.extractUrls(val);
        if (urls.length > 0) {
          addUrls(urls, true);
          composerInput.value = "";
        }
      }
    });

    composerInput.addEventListener("paste", (e) => {
      const pasted = (e.clipboardData || window.clipboardData)?.getData("text") || "";
      if (pasted) {
        const urls = ui.extractUrls(pasted);
        if (urls.length > 0) {
          e.preventDefault();
          addUrls(urls, true);
          composerInput.value = "";
        }
      }
    });
  }

  // Global Enter shortcut: if preview cards are staged and user presses Enter outside other form controls, trigger download
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.target.closest("button, a, select, textarea, .modal-card, #cookies-modal")) {
      if (e.target === composerInput && composerInput.value.trim().length > 0) {
        return; // Handled by composerInput's own Enter listener
      }
      const previewItems = store.getPreviewItems();
      if (previewItems.length > 0 && !isPreviewLoading && btnDownloadAllPreview && !btnDownloadAllPreview.hasAttribute("disabled")) {
        e.preventDefault();
        btnDownloadAllPreview.click();
      }
    }
  });

  // Drag and drop onto composer tray
  if (inputComposer) {
    inputComposer.addEventListener("dragover", (e) => {
      e.preventDefault();
      inputComposer.classList.add("dragover");
    });
    inputComposer.addEventListener("dragleave", () => {
      inputComposer.classList.remove("dragover");
    });
    inputComposer.addEventListener("drop", (e) => {
      e.preventDefault();
      inputComposer.classList.remove("dragover");
      const text = e.dataTransfer?.getData("text") || "";
      if (text) {
        const urls = ui.extractUrls(text);
        if (urls.length > 0) {
          addUrls(urls, true);
        }
      }
    });
  }

  // Paste from clipboard button
  if (btnPaste && navigator.clipboard) {
    btnPaste.addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          const urls = ui.extractUrls(text);
          if (urls.length > 0) {
            addUrls(urls, true);
          } else {
            composerInput.value = text;
            composerInput.focus();
            if (btnClearComposer) btnClearComposer.style.display = "inline-flex";
          }
        }
      } catch (err) {
        console.warn("Clipboard access denied or unavailable", err);
        if (composerInput) composerInput.focus();
      }
    });
  }

  // Clear composer button
  if (btnClearComposer) {
    btnClearComposer.addEventListener("click", () => {
      clearTray();
      if (composerInput) composerInput.focus();
    });
  }

  // Clear preview list
  if (btnClearPreview) {
    btnClearPreview.addEventListener("click", () => {
      clearTray();
      ui.showToast("Lista de preparación vaciada", "info");
    });
  }

  // Start downloading all previewed items immediately with smooth dismiss animation
  if (btnDownloadAllPreview) {
    btnDownloadAllPreview.addEventListener("click", () => {
      const previewItems = store.getPreviewItems();
      if (previewItems.length === 0) return;

      const urls = previewItems.map((i) => i.url);
      const format = currentFormat;
      let quality = selectQuality ? selectQuality.value : null;
      if (format === "mp4") {
        const isVideoQ = videoQualities.some((q) => q.value === quality);
        if (!isVideoQ) quality = "1080";
      } else {
        const isAudioQ = audioQualities.some((q) => q.value === quality);
        if (!isAudioQ) quality = "192";
      }
      const count = previewItems.length;
      const formatUpper = format.toUpperCase();

      // 1. Immediately show queue section and register pending skeletons in store!
      if (queueSection) {
        if (queueDismissTimeout) {
          clearTimeout(queueDismissTimeout);
          queueDismissTimeout = null;
        }
        queueSection.classList.remove("is-collapsing");
        queueSection.style.display = "flex";
      }

      store.startPendingQueue(count, format);
      ui.renderList(queueList, store.getFilteredItems(), store.getPendingQueueCount(), format);
      ui.updateStats(store.getStats());
      updateQueueSectionVisibility();

      // 2. Instantly clear tray and chips
      clearTray();

      // 3. Immediate user feedback toast
      const entityLabel = format === "mp4"
        ? (count === 1 ? "video" : "videos")
        : (count === 1 ? "canción" : "canciones");
      ui.showToast(
        `Iniciando descarga de ${count} ${entityLabel} en formato ${formatUpper}.`,
        "success"
      );

      // 4. Send background download request passing pre-resolved preview metadata
      api.addDownloads(urls, quality, format, previewItems).then(() => {
        setTimeout(() => {
          if (store.getPendingQueueCount() > 0) {
            store.clearPendingQueue();
          }
        }, 1200);
      }).catch((err) => {
        ui.showToast(err.message, "error");
        store.clearPendingQueue();
        updateQueueSectionVisibility();
      });
    });
  }

  // Event delegation on preview list for single item download and removal
  if (previewList) {
    previewList.addEventListener("click", async (e) => {
      const btnRemove = e.target.closest(".btn-remove-preview");
      if (btnRemove) {
        const id = btnRemove.dataset.id;
        const items = store.getPreviewItems();
        const itemToRemove = items.find((i) => i.id === id);

        if (items.length <= 1) {
          const card = document.getElementById(`preview-card-${id}`);
          if (card) card.classList.add("is-removing");
          clearTray();
          return;
        }

        const card = document.getElementById(`preview-card-${id}`);
        if (card) {
          card.classList.add("is-removing");
        }

        setTimeout(() => {
          store.removePreviewItem(id);

          if (itemToRemove && activeUrls.length > 0) {
            if (itemToRemove.playlist_id) {
              const remaining = store.getPreviewItems();
              const stillHasSamePlaylist = remaining.some((i) => i.playlist_id === itemToRemove.playlist_id);
              if (!stillHasSamePlaylist) {
                activeUrls = activeUrls.filter((u) => ui.extractPlaylistId(u) !== itemToRemove.playlist_id);
                renderChips();
                syncUrlsToUI(false);
              }
            } else {
              activeUrls = activeUrls.filter((u) => !ui.urlsMatch(u, itemToRemove.url));
              renderChips();
              syncUrlsToUI(false);
            }
          }
        }, 250);
        return;
      }

      const btnDownloadSingle = e.target.closest(".btn-download-single-preview");
      if (btnDownloadSingle) {
        const id = btnDownloadSingle.dataset.id;
        const items = store.getPreviewItems();
        const target = items.find((i) => i.id === id);
        if (target) {
          const format = currentFormat;
          let quality = selectQuality ? selectQuality.value : null;
          if (format === "mp4") {
            const isVideoQ = videoQualities.some((q) => q.value === quality);
            if (!isVideoQ) quality = "1080";
          } else {
            const isAudioQ = audioQualities.some((q) => q.value === quality);
            if (!isAudioQ) quality = "192";
          }
          btnDownloadSingle.setAttribute("disabled", "true");

          // Immediately show queue section with shimmer skeleton for this item
          if (queueSection) {
            if (queueDismissTimeout) {
              clearTimeout(queueDismissTimeout);
              queueDismissTimeout = null;
            }
            queueSection.classList.remove("is-collapsing");
            queueSection.style.display = "flex";
          }

          store.startPendingQueue(1, format);
          ui.renderList(queueList, store.getFilteredItems(), store.getPendingQueueCount(), format);
          ui.updateStats(store.getStats());
          updateQueueSectionVisibility();

          const willBeEmpty = items.length <= 1;
          if (willBeEmpty) {
            const card = document.getElementById(`preview-card-${id}`);
            if (card) card.classList.add("is-removing");
            clearTray();
          } else {
            const card = document.getElementById(`preview-card-${id}`);
            if (card) {
              card.classList.add("is-removing");
            }
            setTimeout(() => {
              store.removePreviewItem(id);

              if (target.playlist_id) {
                const remaining = store.getPreviewItems();
                const stillHasSamePlaylist = remaining.some((i) => i.playlist_id === target.playlist_id);
                if (!stillHasSamePlaylist) {
                  activeUrls = activeUrls.filter((u) => ui.extractPlaylistId(u) !== target.playlist_id);
                  renderChips();
                  syncUrlsToUI(false);
                }
              } else {
                activeUrls = activeUrls.filter((u) => !ui.urlsMatch(u, target.url));
                renderChips();
                syncUrlsToUI(false);
              }
            }, 250);
          }

          api.addDownloads([target.url], quality, format, [target]).then(() => {
            ui.showToast(`Descargando (${format.toUpperCase()}): ${target.title}`, "success");
            setTimeout(() => {
              if (store.getPendingQueueCount() > 0) {
                store.clearPendingQueue();
              }
            }, 1200);
          }).catch((err) => {
            ui.showToast(err.message, "error");
            btnDownloadSingle.removeAttribute("disabled");
            store.clearPendingQueue();
            updateQueueSectionVisibility();
          });
        }
      }
    });
  }

  // Filter tabs click
  filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      filterTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const filter = tab.dataset.filter;
      store.setFilter(filter);
    });
  });

  // Event delegation on queue list for retry, delete, etc.
  queueList.addEventListener("click", async (e) => {
    const btnDelete = e.target.closest(".btn-delete");
    if (btnDelete) {
      const id = btnDelete.dataset.id;
      try {
        await api.deleteDownload(id);
        store.removeItem(id);
        ui.showToast("Elemento eliminado", "info");
      } catch (err) {
        ui.showToast(err.message, "error");
      }
      return;
    }

    const btnRetry = e.target.closest(".btn-retry");
    if (btnRetry) {
      const id = btnRetry.dataset.id;
      try {
        btnRetry.setAttribute("disabled", "true");
        await api.retryDownload(id);
        ui.showToast("Reanudando descarga...", "info");
      } catch (err) {
        ui.showToast(err.message, "error");
      }
      return;
    }
  });

  // Download all completed as ZIP
  if (btnDownloadZip) {
    btnDownloadZip.addEventListener("click", () => {
      ui.showToast("Preparando archivo ZIP comprimido...", "info");
      window.location.href = api.getZipUrl();
    });
  }

  // Clear completed downloads
  if (btnClearCompleted) {
    btnClearCompleted.addEventListener("click", async () => {
      try {
        const res = await api.clearCompleted();
        // Remove completed and expired from store
        const items = Array.from(store.items.values());
        for (const i of items) {
          if (i.status === "completed" || i.status === "expired") {
            store.removeItem(i.id);
          }
        }
        ui.showToast(`Se limpiaron ${res.cleared_count} descargas.`, "info");
      } catch (err) {
        ui.showToast(err.message, "error");
      }
    });
  }

  // Desktop Notifications Manager (Windows & Linux native browser notifications)
  const getNotificationState = () => {
    if (!("Notification" in window)) return "unsupported";
    if (Notification.permission === "denied") return "denied";
    if (Notification.permission === "granted") {
      const isEnabled = localStorage.getItem("yt_notifications_enabled") !== "false";
      return isEnabled ? "granted" : "paused";
    }
    return "default";
  };

  const refreshNotificationUI = () => {
    ui.updateNotificationUI(getNotificationState());
  };

  const sendDesktopNotification = (title, options = {}) => {
    if (!("Notification" in window)) return null;
    if (Notification.permission !== "granted") return null;
    const isEnabled = localStorage.getItem("yt_notifications_enabled") !== "false";
    if (!isEnabled) return null;

    try {
      const n = new Notification(title, {
        icon: "/favicon.png",
        badge: "/favicon.png",
        silent: false,
        ...options,
      });

      n.onclick = () => {
        window.focus();
        if (typeof options.onClick === "function") options.onClick();
        n.close();
      };
      return n;
    } catch (err) {
      console.warn("Could not display desktop notification:", err);
      return null;
    }
  };

  if (btnToggleNotifications) {
    btnToggleNotifications.addEventListener("click", async () => {
      if (!("Notification" in window)) {
        ui.showToast("Tu navegador no soporta notificaciones de escritorio.", "info");
        return;
      }

      if (Notification.permission === "denied") {
        ui.showToast("Las notificaciones están bloqueadas en tu navegador. Puedes habilitarlas en el candado o configuración junto a la URL.", "error");
        return;
      }

      if (Notification.permission === "default") {
        try {
          const perm = await Notification.requestPermission();
          if (perm === "granted") {
            localStorage.setItem("yt_notifications_enabled", "true");
            refreshNotificationUI();
            ui.showToast("¡Notificaciones de escritorio activadas con éxito!", "success");
            sendDesktopNotification("YT-TrackDown", {
              body: "¡Notificaciones activadas! Te avisaremos cuando tus descargas finalicen en segundo plano.",
              tag: "ytdown-notif-welcome",
            });
          } else {
            refreshNotificationUI();
            ui.showToast("Permiso de notificaciones no concedido.", "info");
          }
        } catch (err) {
          console.warn("Error requesting notification permission:", err);
        }
        return;
      }

      if (Notification.permission === "granted") {
        const isCurrentlyEnabled = localStorage.getItem("yt_notifications_enabled") !== "false";
        const nextState = !isCurrentlyEnabled;
        localStorage.setItem("yt_notifications_enabled", nextState ? "true" : "false");
        refreshNotificationUI();
        ui.showToast(
          nextState ? "Notificaciones de escritorio activadas." : "Notificaciones de escritorio pausadas.",
          "info"
        );
      }
    });

    if ("permissions" in navigator && navigator.permissions.query) {
      navigator.permissions.query({ name: "notifications" }).then((status) => {
        status.onchange = () => refreshNotificationUI();
      }).catch(() => {});
    }

    refreshNotificationUI();
  }

  // Progressive visibility controller for downloads queue section
  let queueDismissTimeout = null;

  const updateQueueSectionVisibility = () => {
    if (!queueSection) return;
    const stats = store.getStats();
    const hasDownloads = stats.total > 0;

    if (hasDownloads) {
      if (queueDismissTimeout) {
        clearTimeout(queueDismissTimeout);
        queueDismissTimeout = null;
      }
      if (queueSection.style.display === "none" || queueSection.classList.contains("is-collapsing")) {
        queueSection.classList.remove("is-collapsing");
        queueSection.style.display = "flex";
      }
    } else {
      if (queueSection.style.display !== "none" && !queueSection.classList.contains("is-collapsing")) {
        queueSection.classList.add("is-collapsing");
        if (queueDismissTimeout) clearTimeout(queueDismissTimeout);
        queueDismissTimeout = setTimeout(() => {
          queueDismissTimeout = null;
          queueSection.style.display = "none";
          queueSection.classList.remove("is-collapsing");
        }, 280);
      }
    }
  };

  // Reactive store subscription: re-renders list when necessary & triggers completion notifications
  let prevDownloadingCount = 0;
  let batchCompletedInSession = 0;
  let lastCompletedTitle = "";

  store.subscribe((event, payload) => {
    const stats = store.getStats();
    ui.updateStats(stats);
    updateQueueSectionVisibility();

    // Track completed items in this active session
    if (event === "item_updated" && payload && payload.status === "completed") {
      batchCompletedInSession++;
      lastCompletedTitle = payload.title || (payload.format === "mp4" ? "Video descargado" : "Pista de audio descargada");
    }

    // Detect when all active downloading tasks have finished
    if (prevDownloadingCount > 0 && stats.downloading === 0) {
      if (batchCompletedInSession > 0) {
        if (batchCompletedInSession === 1) {
          sendDesktopNotification("¡Descarga completada!", {
            body: lastCompletedTitle ? `"${lastCompletedTitle}" está lista para guardar.` : "Tu descarga ha finalizado con éxito.",
            tag: "ytdown-complete",
          });
        } else {
          sendDesktopNotification("¡Descargas completadas!", {
            body: `Se completaron ${batchCompletedInSession} descargas con éxito en segundo plano.`,
            tag: "ytdown-batch-complete",
          });
        }
        batchCompletedInSession = 0;
        lastCompletedTitle = "";
      }
    }
    prevDownloadingCount = stats.downloading;

    if (event === "preview_updated") {
      const previewItems = store.getPreviewItems();
      if (previewItems.length > 0) {
        cancelDismissPreview();
        previewSection.style.display = "flex";
        previewCounter.textContent = `${previewItems.length}`;
        previewBtnCount.textContent = `${previewItems.length}`;
        const previewBtnFormat = document.getElementById("preview-btn-format");
        if (previewBtnFormat) {
          previewBtnFormat.textContent = currentFormat.toUpperCase();
        }
        updatePreviewHeader();
        ui.renderPreviewList(previewList, previewItems, currentFormat);
      } else {
        if (!previewSection.classList.contains("is-collapsing") && previewSection.style.display !== "none") {
          dismissPreviewSection();
        }
      }
      return;
    }

    if (event === "item_progress") {
      // Fast incremental DOM update without full re-render
      ui.updateProgressDOM(payload);
      return;
    }

    if (event === "item_updated") {
      const card = document.getElementById(`card-${payload.id}`);
      if (card) {
        ui.updateCardDOM(payload);
      } else {
        ui.renderList(queueList, store.getFilteredItems(), store.getPendingQueueCount(), currentFormat);
      }
      return;
    }

    // For init, item_added, item_removed, filter_changed, pending_queue_changed: full render
    ui.renderList(queueList, store.getFilteredItems(), store.getPendingQueueCount(), currentFormat);
  });

  // Cookies Modal & Management Logic
  const btnOpenCookies = document.getElementById("btn-open-cookies");
  const cookiesModal = document.getElementById("cookies-modal");
  const btnCloseCookiesModal = document.getElementById("btn-close-cookies-modal");
  const btnCloseCookiesFooter = document.getElementById("btn-close-cookies-modal-footer");
  const cookieDropzone = document.getElementById("cookie-dropzone");
  const cookieFileInput = document.getElementById("cookie-file-input");
  const btnDeleteCookies = document.getElementById("btn-delete-cookies");

  const refreshCookiesStatus = async () => {
    try {
      const status = await api.getCookiesStatus();
      ui.updateCookiesStatusUI(status);
      return status;
    } catch (err) {
      console.error("Error fetching cookies status:", err);
    }
  };

  const openCookiesModal = () => {
    if (!cookiesModal) return;
    cookiesModal.style.display = "flex";
    refreshCookiesStatus();
  };

  const closeCookiesModal = () => {
    if (!cookiesModal) return;
    cookiesModal.style.display = "none";
  };

  if (btnOpenCookies) {
    btnOpenCookies.addEventListener("click", openCookiesModal);
  }

  if (btnCloseCookiesModal) {
    btnCloseCookiesModal.addEventListener("click", closeCookiesModal);
  }

  if (btnCloseCookiesFooter) {
    btnCloseCookiesFooter.addEventListener("click", closeCookiesModal);
  }

  if (cookiesModal) {
    cookiesModal.addEventListener("click", (e) => {
      if (e.target === cookiesModal) {
        closeCookiesModal();
      }
    });
  }

  const handleCookiesFileUpload = async (file) => {
    if (!file) return;
    try {
      ui.showToast("Subiendo y validando archivo de cookies...", "info");
      const res = await api.uploadCookies(file);
      ui.showToast(res.message || "Cookies activadas correctamente", "success");
      ui.updateCookiesStatusUI(res.status);
    } catch (err) {
      ui.showToast(err.message || "Error al procesar el archivo de cookies", "error");
    } finally {
      if (cookieFileInput) cookieFileInput.value = "";
    }
  };

  if (cookieDropzone && cookieFileInput) {
    cookieDropzone.addEventListener("click", () => {
      cookieFileInput.click();
    });

    cookieFileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        handleCookiesFileUpload(file);
      }
    });

    cookieDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      cookieDropzone.classList.add("dragover");
    });

    cookieDropzone.addEventListener("dragleave", () => {
      cookieDropzone.classList.remove("dragover");
    });

    cookieDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      cookieDropzone.classList.remove("dragover");
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) {
        handleCookiesFileUpload(file);
      }
    });
  }

  if (btnDeleteCookies) {
    btnDeleteCookies.addEventListener("click", async () => {
      try {
        const res = await api.deleteCookies();
        ui.showToast("Cookies eliminadas correctamente", "info");
        ui.updateCookiesStatusUI(res.status);
      } catch (err) {
        ui.showToast(err.message || "Error al eliminar cookies", "error");
      }
    });
  }

  // Load initial cookies status
  refreshCookiesStatus();

  // Connect to SSE stream
  api.connectEvents(
    (eventType, data) => {
      switch (eventType) {
        case "init":
          store.setInitial(data.items || []);
          break;
        case "item_added":
          store.addItem(data);
          break;
        case "item_updated":
          store.updateItem(data);
          break;
        case "item_progress":
          store.updateProgress(data.id, data.progress, data.status);
          break;
        case "item_removed":
          store.removeItem(data.id);
          break;
      }
    },
    (isConnected) => {
      if (connectionDot) {
        if (isConnected) {
          connectionDot.classList.add("connected");
          connectionDot.title = "Conectado al servidor en tiempo real";
        } else {
          connectionDot.classList.remove("connected");
          connectionDot.title = "Reconectando con el servidor...";
        }
      }
    }
  );
});
