export type WriteMode = "create" | "replace";

export type WritePreview = {
  previewId: string;
  notePath: string;
  mode: WriteMode;
  beforeHash: string | null;
  proposedHash: string;
  proposedContent: string;
  expiresAt: number;
};

const DEFAULT_MAX_PREVIEWS = 100;

export class WritePreviewStore {
  readonly #previews = new Map<string, WritePreview>();
  readonly #maxEntries: number;

  constructor(maxEntries = DEFAULT_MAX_PREVIEWS) {
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError("maxEntries must be a positive safe integer");
    }
    this.#maxEntries = maxEntries;
  }

  put(preview: WritePreview, now = Date.now()): void {
    this.pruneExpired(now);
    this.#previews.delete(preview.previewId);
    while (this.#previews.size >= this.#maxEntries) {
      const oldestPreviewId = this.#previews.keys().next().value;
      if (oldestPreviewId === undefined) break;
      this.#previews.delete(oldestPreviewId);
    }
    this.#previews.set(preview.previewId, preview);
  }

  get(previewId: string): WritePreview | undefined {
    return this.#previews.get(previewId);
  }

  remove(previewId: string): void {
    this.#previews.delete(previewId);
  }

  take(previewId: string): WritePreview | undefined {
    const preview = this.#previews.get(previewId);
    if (preview) this.#previews.delete(previewId);
    return preview;
  }

  private pruneExpired(now: number): void {
    for (const [previewId, preview] of this.#previews) {
      if (now > preview.expiresAt) this.#previews.delete(previewId);
    }
  }
}
