/**
 * Storage for regulation-document file bodies. Backed by Workers KV (no card needed, unlike R2).
 * Swapping to R2/Supabase later only touches this file.
 *
 * KV limits: 25 MiB per value (uploads are capped at 20 MB), eventually consistent across
 * locations (a fresh upload can take ~60 s to be readable elsewhere), free plan = 1,000 writes/day.
 */
export interface StoredFileMeta {
  contentType: string;
  fileName: string;
  size: number;
}

export interface StoredFile {
  body: ReadableStream;
  metadata: StoredFileMeta;
}

type StoreEnv = Pick<Env, "DOCS">;

/**
 * KV metadata is capped at 1 KiB and travels in an ASCII header: keep the tail of long names,
 * percent-encoded (worst case 9 chars per character). Informational only; D1 holds the real name.
 */
const META_NAME_CHARS = 60;

export const documentFileStore = {
  async put(env: StoreEnv, key: string, bytes: ArrayBuffer, metadata: StoredFileMeta) {
    await env.DOCS.put(key, bytes, {
      metadata: {
        ...metadata,
        fileName: encodeURIComponent(metadata.fileName.slice(-META_NAME_CHARS)),
      },
    });
  },

  /** `null` when the value is missing (never written, deleted, or not yet replicated). */
  async get(env: StoreEnv, key: string): Promise<StoredFile | null> {
    const { value, metadata } = await env.DOCS.getWithMetadata<StoredFileMeta>(key, "stream");
    if (!value || !metadata) return null;
    return { body: value, metadata };
  },

  /** Best-effort: an orphaned value is harmless, a failed cleanup must not mask the real result. */
  async delete(env: StoreEnv, key: string): Promise<void> {
    try {
      await env.DOCS.delete(key);
    } catch (err) {
      console.error("document file delete failed", key, err instanceof Error ? err.message : err);
    }
  },
};
