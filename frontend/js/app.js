import { api } from "./api.js";
import { store } from "./store.js";
import { ui, icons } from "./ui.js";

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const composerTextarea = document.getElementById("composer-textarea");
  const linkCounterChip = document.getElementById("link-counter-chip");
  const btnSubmit = document.getElementById("btn-submit-downloads");
  const btnPaste = document.getElementById("btn-paste-clipboard");
  const btnClearComposer = document.getElementById("btn-clear-composer");
  const selectQuality = document.getElementById("select-quality");
  const queueList = document.getElementById("queue-list");
  const connectionDot = document.getElementById("connection-dot");
  const filterTabs = document.querySelectorAll(".filter-tab");
  const btnDownloadZip = document.getElementById("btn-download-zip");
  const btnClearCompleted = document.getElementById("btn-clear-completed");

  // Preview elements
  const previewSection = document.getElementById("preview-section");
  const previewList = document.getElementById("preview-list");
  const previewCounter = document.getElementById("preview-counter");
  const previewBtnCount = document.getElementById("preview-btn-count");
  const btnClearPreview = document.getElementById("btn-clear-preview");
  const btnDownloadAllPreview = document.getElementById("btn-download-all-preview");

  // Custom styled quality dropdown logic
  const setupCustomQualitySelect = () => {
    const wrap = document.getElementById("quality-dropdown-wrap");
    const trigger = document.getElementById("quality-trigger-btn");
    const menu = document.getElementById("quality-options-menu");
    const currentLabel = document.getElementById("quality-current-label");
    const currentBadge = document.getElementById("quality-current-badge");
    const options = menu ? menu.querySelectorAll(".custom-select-option") : [];

    if (!wrap || !trigger || !menu || !selectQuality) return;

    const badgeMap = {
      "320": { label: "320 kbps", badge: "Máxima", class: "badge-max" },
      "256": { label: "256 kbps", badge: "Alta", class: "badge-high" },
      "192": { label: "192 kbps", badge: "Estándar", class: "badge-std" },
      "128": { label: "128 kbps", badge: "Ligera", class: "badge-light" },
    };

    const updateTriggerUI = (val) => {
      const info = badgeMap[val] || { label: `${val} kbps`, badge: "", class: "" };
      if (currentLabel) currentLabel.textContent = info.label;
      if (currentBadge) {
        currentBadge.textContent = info.badge;
        currentBadge.className = `custom-select-badge ${info.class}`;
      }

      options.forEach((opt) => {
        const isMatch = opt.dataset.value === val;
        opt.classList.toggle("is-selected", isMatch);
        opt.setAttribute("aria-selected", isMatch ? "true" : "false");
      });
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

    // Initial sync
    updateTriggerUI(selectQuality.value || "192");
  };

  setupCustomQualitySelect();

  // Track live URLs in textarea
  const updateDetectedUrls = (syncPreview = false) => {
    const text = composerTextarea.value;
    const urls = ui.extractUrls(text);
    const count = urls.length;
    const hasPlaylist = urls.some(
      (u) => u.includes("playlist?list=") || u.includes("&list=") || u.includes("list=PL")
    );

    if (btnClearComposer) {
      btnClearComposer.style.display = text.trim().length > 0 ? "inline-flex" : "none";
    }

    if (count > 0) {
      if (hasPlaylist) {
        linkCounterChip.innerHTML = `<span style="color:var(--accent-amber); font-weight:600;">🎵 Playlist</span> &bull; ${count} ${count === 1 ? "enlace" : "enlaces"}`;
      } else {
        linkCounterChip.textContent = `${count} ${count === 1 ? "enlace" : "enlaces"}`;
      }
      linkCounterChip.classList.add("has-links");
      btnSubmit.removeAttribute("disabled");
    } else {
      linkCounterChip.textContent = "0 enlaces";
      linkCounterChip.classList.remove("has-links");
      btnSubmit.setAttribute("disabled", "true");
    }

    // Synchronize preview in real time if requested
    if (syncPreview) {
      if (urls.length === 0) {
        store.clearPreview();
      } else {
        const previewItems = store.getPreviewItems();
        if (previewItems.length > 0) {
          for (const item of previewItems) {
            const stillPresent = ui.itemMatchesUrlList(item, urls);
            if (!stillPresent) {
              store.removePreviewItem(item.id);
            }
          }
        }
      }
    }

    return urls;
  };

  composerTextarea.addEventListener("input", () => {
    if (!isPreviewLoading) {
      updateDetectedUrls(true);
    } else {
      updateDetectedUrls(false);
    }
  });

  // Keyboard shortcut: Ctrl+Enter or Cmd+Enter to submit
  composerTextarea.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      btnSubmit.click();
    }
  });

  // Helper to fetch preview and stage items without downloading yet
  let isPreviewLoading = false;

  const handlePreview = async (urls) => {
    if (!urls || urls.length === 0 || isPreviewLoading) return;
    isPreviewLoading = true;

    const originalBtnHtml = btnSubmit.innerHTML;
    btnSubmit.setAttribute("disabled", "true");
    btnSubmit.innerHTML = `${icons.spinner} Inspeccionando enlaces...`;

    try {
      const res = await api.getPreview(urls);
      if (res.items && res.items.length > 0) {
        store.setPreviewItems(res.items);
        // NOTE: The link(s) stay in composerTextarea until the download is actually performed
        ui.showToast(
          `Se ${res.count === 1 ? "preparó 1 pista" : "prepararon " + res.count + " pistas"} en la lista inferior.`,
          "success"
        );
      }
    } catch (err) {
      ui.showToast(err.message, "error");
    } finally {
      isPreviewLoading = false;
      btnSubmit.innerHTML = originalBtnHtml;
      updateDetectedUrls(false);
    }
  };

  // Auto-detect when pasting in textarea
  let pasteTimeout = null;
  composerTextarea.addEventListener("paste", () => {
    if (pasteTimeout) clearTimeout(pasteTimeout);
    pasteTimeout = setTimeout(() => {
      const urls = updateDetectedUrls(false);
      if (urls.length > 0) {
        handlePreview(urls);
      }
    }, 250);
  });

  // Paste from clipboard button
  if (btnPaste && navigator.clipboard) {
    btnPaste.addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          const urls = ui.extractUrls(text);
          if (urls.length > 0) {
            handlePreview(urls);
          } else {
            composerTextarea.value = text;
            updateDetectedUrls();
            composerTextarea.focus();
          }
        }
      } catch (err) {
        console.warn("Clipboard access denied or unavailable", err);
        composerTextarea.focus();
      }
    });
  }

  // Helper to smoothly animate and dismiss the preview section
  const dismissPreviewSection = (callback) => {
    if (!previewSection || previewSection.style.display === "none") {
      if (callback) callback();
      return;
    }
    previewSection.classList.add("fade-out");
    setTimeout(() => {
      previewSection.style.display = "none";
      previewSection.classList.remove("fade-out");
      previewList.innerHTML = "";
      if (callback) callback();
    }, 240);
  };

  // Clear textarea button
  if (btnClearComposer) {
    btnClearComposer.addEventListener("click", () => {
      composerTextarea.value = "";
      updateDetectedUrls(false);
      dismissPreviewSection(() => {
        store.clearPreview();
      });
      composerTextarea.focus();
    });
  }

  // Previsualizar y Añadir button click
  btnSubmit.addEventListener("click", () => {
    const urls = updateDetectedUrls();
    if (urls.length > 0) {
      handlePreview(urls);
    }
  });

  // Clear preview list
  if (btnClearPreview) {
    btnClearPreview.addEventListener("click", () => {
      composerTextarea.value = "";
      updateDetectedUrls(false);
      dismissPreviewSection(() => {
        store.clearPreview();
      });
      ui.showToast("Lista de preparación vaciada", "info");
    });
  }

  // Start downloading all previewed items immediately with smooth dismiss animation
  if (btnDownloadAllPreview) {
    btnDownloadAllPreview.addEventListener("click", () => {
      const previewItems = store.getPreviewItems();
      if (previewItems.length === 0) return;

      const urls = previewItems.map((i) => i.url);
      const quality = selectQuality.value;
      const count = previewItems.length;

      // 1. Instantly clear textarea and URL chips
      composerTextarea.value = "";
      updateDetectedUrls(false);

      // 2. Instantly trigger smooth fade-out exit animation
      dismissPreviewSection(() => {
        store.clearPreview();
      });

      // 3. Immediate user feedback toast
      ui.showToast(
        `Iniciando descarga de ${count} ${count === 1 ? "canción" : "canciones"} en formato MP3.`,
        "success"
      );

      // 4. Send background download request
      api.addDownloads(urls, quality).catch((err) => {
        ui.showToast(err.message, "error");
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
          composerTextarea.value = "";
          updateDetectedUrls(false);
          dismissPreviewSection(() => {
            store.removePreviewItem(id);
          });
          return;
        }

        store.removePreviewItem(id);

        if (itemToRemove && composerTextarea.value) {
          if (itemToRemove.playlist_id) {
            const remaining = store.getPreviewItems();
            const stillHasSamePlaylist = remaining.some((i) => i.playlist_id === itemToRemove.playlist_id);
            if (!stillHasSamePlaylist) {
              const currentUrls = ui.extractUrls(composerTextarea.value);
              const remainingUrls = currentUrls.filter((u) => ui.extractPlaylistId(u) !== itemToRemove.playlist_id);
              composerTextarea.value = remainingUrls.join("\n");
              updateDetectedUrls(false);
            }
          } else {
            const currentUrls = ui.extractUrls(composerTextarea.value);
            const remainingUrls = currentUrls.filter((u) => !ui.urlsMatch(u, itemToRemove.url));
            composerTextarea.value = remainingUrls.join("\n");
            updateDetectedUrls(false);
          }
        }
        return;
      }

      const btnDownloadSingle = e.target.closest(".btn-download-single-preview");
      if (btnDownloadSingle) {
        const id = btnDownloadSingle.dataset.id;
        const items = store.getPreviewItems();
        const target = items.find((i) => i.id === id);
        if (target) {
          const quality = selectQuality.value;
          btnDownloadSingle.setAttribute("disabled", "true");

          const willBeEmpty = items.length <= 1;
          if (willBeEmpty) {
            composerTextarea.value = "";
            updateDetectedUrls(false);
            dismissPreviewSection(() => {
              store.removePreviewItem(id);
            });
          } else {
            store.removePreviewItem(id);

            // Remove downloaded URL from textarea if no more items from that source/playlist
            if (composerTextarea.value) {
              if (target.playlist_id) {
                const remaining = store.getPreviewItems();
                const stillHasSamePlaylist = remaining.some((i) => i.playlist_id === target.playlist_id);
                if (!stillHasSamePlaylist) {
                  const currentUrls = ui.extractUrls(composerTextarea.value);
                  const remainingUrls = currentUrls.filter((u) => ui.extractPlaylistId(u) !== target.playlist_id);
                  composerTextarea.value = remainingUrls.join("\n");
                  updateDetectedUrls(false);
                }
              } else {
                const currentUrls = ui.extractUrls(composerTextarea.value);
                const remainingUrls = currentUrls.filter((u) => !ui.urlsMatch(u, target.url));
                composerTextarea.value = remainingUrls.join("\n");
                updateDetectedUrls(false);
              }
            }
          }

          api.addDownloads([target.url], quality).then(() => {
            ui.showToast(`Descargando: ${target.title}`, "success");
          }).catch((err) => {
            ui.showToast(err.message, "error");
            btnDownloadSingle.removeAttribute("disabled");
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
        const items = store.getFilteredItems();
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

  // Reactive store subscription: re-renders list when necessary
  store.subscribe((event, payload) => {
    const stats = store.getStats();
    ui.updateStats(stats);

    if (event === "preview_updated") {
      const previewItems = store.getPreviewItems();
      if (previewItems.length > 0) {
        previewSection.classList.remove("fade-out");
        previewSection.style.display = "flex";
        previewCounter.textContent = `${previewItems.length}`;
        previewBtnCount.textContent = `${previewItems.length}`;
        ui.renderPreviewList(previewList, previewItems);
      } else {
        if (!previewSection.classList.contains("fade-out")) {
          previewSection.style.display = "none";
          previewList.innerHTML = "";
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
        ui.renderList(queueList, store.getFilteredItems());
      }
      return;
    }

    // For init, item_added, item_removed, filter_changed: full render
    ui.renderList(queueList, store.getFilteredItems());
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
