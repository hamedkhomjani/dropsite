import { getStore } from '@netlify/blobs'

export const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000 // files are kept for 3 days
export const MAX_FILE_SIZE = 5 * 1024 * 1024 // Netlify Functions accept request bodies up to ~6 MB

export interface FileMeta {
  id: string
  /** Stored name in the form name__uuid.ext (used in download links) */
  storedName: string
  /** Original, sanitised file name */
  originalName: string
  size: number
  contentType: string
  uploadedAt: number
}

// Strong consistency so a file is readable right after the upload redirect.
export const filesStore = () => getStore({ name: 'droplab-files', consistency: 'strong' })

const dataKey = (id: string) => `data/${id}`
const metaKey = (id: string) => `meta/${id}`

export async function saveFile(meta: FileMeta, data: ArrayBuffer) {
  const store = filesStore()
  await store.set(dataKey(meta.id), data)
  await store.setJSON(metaKey(meta.id), meta)
}

export const isExpired = (meta: FileMeta, now = Date.now()) => now - meta.uploadedAt > MAX_AGE_MS

/** Returns metadata for a live file; removes and returns null when it has expired. */
export async function getFileMeta(id: string): Promise<FileMeta | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const meta = (await filesStore().get(metaKey(id), { type: 'json' })) as FileMeta | null
  if (!meta) return null
  if (isExpired(meta)) {
    await deleteFile(id)
    return null
  }
  return meta
}

export const getFileStream = (id: string) => filesStore().get(dataKey(id), { type: 'stream' })

export async function deleteFile(id: string) {
  const store = filesStore()
  await store.delete(dataKey(id))
  await store.delete(metaKey(id))
}

/** Deletes every expired file. Returns how many were removed. */
export async function cleanupExpired(): Promise<number> {
  const store = filesStore()
  const { blobs } = await store.list({ prefix: 'meta/' })
  const now = Date.now()
  let removed = 0
  for (const { key } of blobs) {
    const meta = (await store.get(key, { type: 'json' })) as FileMeta | null
    if (!meta || isExpired(meta, now)) {
      await deleteFile(key.slice('meta/'.length))
      removed++
    }
  }
  return removed
}

/** Mirrors werkzeug's secure_filename closely enough for display/download names. */
export function secureFilename(name: string): string {
  const ascii = name.normalize('NFKD').replace(/[^\x00-\x7f]/g, '')
  const base = ascii.split(/[\\/]/).pop() ?? ''
  return base
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_.-]/g, '')
    .replace(/^[._]+|[._]+$/g, '')
}

/** Extracts the file id from a link, a stored name (name__uuid.ext) or a bare id. */
export function extractFileId(input: string): string | null {
  const match = input.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)
  return match ? match[match.length - 1].toLowerCase() : null
}

export function formatSize(bytes: number): string {
  let value = bytes
  for (const unit of ['B', 'KB', 'MB', 'GB']) {
    if (value < 1024 || unit === 'GB') {
      return unit === 'B' ? `${Math.trunc(value)} ${unit}` : `${value.toFixed(1)} ${unit}`
    }
    value /= 1024
  }
  return `${value.toFixed(1)} TB`
}

export function timeLeft(meta: FileMeta) {
  const left = Math.max(0, Math.floor((MAX_AGE_MS - (Date.now() - meta.uploadedAt)) / 1000))
  return {
    days: Math.floor(left / 86400),
    hours: Math.floor((left % 86400) / 3600),
    minutes: Math.floor((left % 3600) / 60),
    seconds: left % 60,
  }
}
