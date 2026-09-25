/**
 * Reactive state store for download queue
 */
class Store {
  constructor() {
    this.items = new Map();
    this.previewItems = new Map();
    this.activeFilter = "all"; // 'all' | 'downloading' | 'completed' | 'error'
    this.subscribers = new Set();
  }

  setPreviewItems(newItems) {
    this.previewItems.clear();
    for (const item of newItems) {
      this.previewItems.set(item.id, item);
    }
    this.notify("preview_updated", Array.from(this.previewItems.values()));
  }

  addPreviewItems(newItems) {
    for (const item of newItems) {
      this.previewItems.set(item.id, item);
    }
    this.notify("preview_updated", Array.from(this.previewItems.values()));
  }

  removePreviewItem(id) {
    this.previewItems.delete(id);
    this.notify("preview_updated", Array.from(this.previewItems.values()));
  }

  clearPreview() {
    this.previewItems.clear();
    this.notify("preview_updated", []);
  }

  getPreviewItems() {
    return Array.from(this.previewItems.values());
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify(event, payload) {
    for (const callback of this.subscribers) {
      try {
        callback(event, payload, this);
      } catch (err) {
        console.error("Store subscriber error:", err);
      }
    }
  }

  setInitial(items) {
    this.items.clear();
    for (const item of items) {
      this.items.set(item.id, item);
    }
    this.notify("init", items);
  }

  addItem(item) {
    this.items.set(item.id, item);
    this.notify("item_added", item);
  }

  updateItem(item) {
    const existing = this.items.get(item.id);
    this.items.set(item.id, { ...existing, ...item });
    this.notify("item_updated", item);
  }

  updateProgress(id, progress, status) {
    const item = this.items.get(id);
    if (item) {
      item.progress = progress;
      if (status) item.status = status;
      this.notify("item_progress", item);
    }
  }

  removeItem(id) {
    this.items.delete(id);
    this.notify("item_removed", id);
  }

  setFilter(filter) {
    this.activeFilter = filter;
    this.notify("filter_changed", filter);
  }

  getFilteredItems() {
    const all = Array.from(this.items.values());
    if (this.activeFilter === "downloading") {
      return all.filter((i) =>
        ["queued", "fetching_info", "downloading", "converting"].includes(i.status)
      );
    }
    if (this.activeFilter === "completed") {
      return all.filter((i) => i.status === "completed");
    }
    if (this.activeFilter === "error") {
      return all.filter((i) => i.status === "error");
    }
    return all;
  }

  getStats() {
    const all = Array.from(this.items.values());
    const completedItems = all.filter((i) => i.status === "completed");
    const totalBytes = completedItems.reduce((acc, item) => acc + (item.file_size || 0), 0);
    return {
      total: all.length,
      downloading: all.filter((i) =>
        ["queued", "fetching_info", "downloading", "converting"].includes(i.status)
      ).length,
      completed: completedItems.length,
      error: all.filter((i) => i.status === "error").length,
      expired: all.filter((i) => i.status === "expired").length,
      total_completed_bytes: totalBytes,
    };
  }
}

export const store = new Store();
