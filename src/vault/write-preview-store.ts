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

export class WritePreviewStore {
  readonly #previews = new Map<string, WritePreview>();

  put(preview: WritePreview): void {
    this.#previews.set(preview.previewId, preview);
  }

  get(previewId: string): WritePreview | undefined {
    return this.#previews.get(previewId);
  }

  remove(previewId: string): void {
    this.#previews.delete(previewId);
  }
}
