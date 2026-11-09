import type { Config, Context } from '@netlify/functions'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import nunjucks from 'nunjucks'
import translations from '../../translations.json' with { type: 'json' }
import {
  MAX_FILE_SIZE,
  deleteFile,
  extractFileId,
  formatSize,
  getFileMeta,
  getFileStream,
  saveFile,
  secureFilename,
  timeLeft,
  type FileMeta,
} from '../lib/files.mts'

type Lang = 'fa' | 'en' | 'sv'
const LANGS: Lang[] = ['sv', 'en', 'fa']
const T = translations as Record<Lang, Record<string, string>>

// Executable / script file types are rejected for security.
const FORBIDDEN_EXTENSIONS = new Set(['exe', 'bat', 'cmd', 'sh', 'vbs', 'ps1', 'msi', 'jar', 'scr', 'com', 'pif'])

const ROUTES: Record<string, string> = {
  home: '/',
  about: '/about',
  contact: '/contact',
  privacy: '/privacy',
  upload: '/upload',
  download_manual: '/download_manual',
  success: '/success/:file_id',
  delete_file: '/delete/:file_id',
  download: '/files/:filename',
}

/** Flask-compatible url_for() so the existing Jinja templates render unchanged. */
function urlFor(name: string, ...args: unknown[]): string {
  const last = args[args.length - 1] as Record<string, unknown> | undefined
  const kwargs: Record<string, unknown> = last && typeof last === 'object' && (last as any).__keywords ? { ...last } : {}
  delete kwargs.__keywords
  let route = ROUTES[name] ?? '/'
  route = route.replace(/:(\w+)/g, (_, key) => {
    const value = encodeURIComponent(String(kwargs[key] ?? ''))
    delete kwargs[key]
    return value
  })
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(kwargs)) {
    if (value !== undefined && value !== null && !key.startsWith('_')) query.set(key, String(value))
  }
  const qs = query.toString()
  return qs ? `${route}?${qs}` : route
}

let env: nunjucks.Environment | undefined
function getEnv() {
  if (env) return env
  const here = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.join(process.cwd(), 'templates'),
    process.env.LAMBDA_TASK_ROOT ? path.join(process.env.LAMBDA_TASK_ROOT, 'templates') : '',
    path.resolve(here, '../../templates'),
    path.resolve(here, 'templates'),
  ].filter(Boolean)
  const dir = candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
  env = new nunjucks.Environment(new nunjucks.FileSystemLoader(dir), { autoescape: true })
  env.addGlobal('url_for', urlFor)
  return env
}

function html(template: string, lang: Lang, vars: Record<string, unknown> = {}, status = 200) {
  const body = getEnv().render(template, { lang, t: T[lang], ...vars })
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

function redirect(location: string) {
  return new Response(null, { status: 303, headers: { Location: location } })
}

/** Active language from ?lang= (remembered in a cookie) or the cookie, defaulting to Swedish. */
function getLang(url: URL, context: Context): Lang {
  const fromQuery = url.searchParams.get('lang') as Lang | null
  if (fromQuery && LANGS.includes(fromQuery)) {
    context.cookies.set({ name: 'lang', value: fromQuery, path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'Lax' })
    return fromQuery
  }
  const fromCookie = context.cookies.get('lang') as Lang | undefined
  return fromCookie && LANGS.includes(fromCookie) ? fromCookie : 'sv'
}

function fileVars(meta: FileMeta) {
  return { file_name: meta.originalName, file_size: formatSize(meta.size), ...timeLeft(meta) }
}

async function handleUpload(req: Request, lang: Lang) {
  const length = Number(req.headers.get('content-length') ?? 0)
  if (length > MAX_FILE_SIZE + 64 * 1024) return new Response(T[lang].error_file_too_large, { status: 413 })

  let file: FormDataEntryValue | null
  try {
    file = (await req.formData()).get('file')
  } catch {
    return new Response('Invalid upload', { status: 400 })
  }
  if (!file || typeof file === 'string' || !file.name) return new Response('No file selected', { status: 400 })
  if (file.size > MAX_FILE_SIZE) return new Response(T[lang].error_file_too_large, { status: 413 })

  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
  if (FORBIDDEN_EXTENSIONS.has(ext)) return new Response('File type not allowed (Security Restriction)', { status: 415 })

  const id = randomUUID()
  const safeName = secureFilename(file.name)
  const dot = safeName.lastIndexOf('.')
  const root = (dot > 0 ? safeName.slice(0, dot) : safeName) || 'file'
  const extension = dot > 0 ? safeName.slice(dot) : ''

  await saveFile(
    {
      id,
      storedName: `${root}__${id}${extension}`,
      originalName: `${root}${extension}`,
      size: file.size,
      contentType: file.type || 'application/octet-stream',
      uploadedAt: Date.now(),
    },
    await file.arrayBuffer(),
  )
  return redirect(`/success/${id}`)
}

async function handleDownload(storedName: string) {
  const id = extractFileId(storedName)
  const meta = id ? await getFileMeta(id) : null
  const stream = meta ? await getFileStream(meta.id) : null
  if (!meta || !stream) return new Response('File not found', { status: 404 })

  const downloadName = meta.originalName.startsWith('DropLab_') ? meta.originalName : `DropLab_${meta.originalName}`
  return new Response(stream as ReadableStream, {
    headers: {
      'Content-Type': meta.contentType,
      'Content-Length': String(meta.size),
      'Content-Disposition': `attachment; filename="${downloadName.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      'Cache-Control': 'no-store',
    },
  })
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url)
  const pathname = url.pathname.replace(/\/+$/, '') || '/'
  const method = req.method.toUpperCase()
  const lang = getLang(url, context)

  try {
    if (method === 'GET') {
      if (pathname === '/') return html('index.html', lang)
      if (pathname === '/about') return html('about.html', lang)
      if (pathname === '/contact') return html('contact.html', lang)
      if (pathname === '/privacy') return html('privacy.html', lang)

      const success = pathname.match(/^\/success\/([^/]+)$/)
      if (success) {
        const meta = await getFileMeta(decodeURIComponent(success[1]))
        if (!meta) return redirect(urlFor('home', { lang, __keywords: true }))
        const link = new URL(urlFor('download', { filename: meta.storedName, __keywords: true }), url.origin).toString()
        return html('success.html', lang, { link, file_id: meta.id, ...fileVars(meta) })
      }

      const files = pathname.match(/^\/files\/(.+)$/)
      if (files) return handleDownload(decodeURIComponent(files[1]))
    }

    if (method === 'POST') {
      if (pathname === '/upload') return handleUpload(req, lang)

      if (pathname === '/download_manual') {
        const form = await req.formData().catch(() => null)
        const link = String(form?.get('file_link') ?? '').trim()
        const id = extractFileId(link)
        const meta = id ? await getFileMeta(id) : null
        if (!meta) {
          const key = id ? 'error_file_not_found' : 'error_invalid_link'
          return html('download_manual.html', lang, { error: T[lang][key] ?? 'File not found' })
        }
        const download_url = urlFor('download', { filename: meta.storedName, __keywords: true })
        return html('download_manual.html', lang, { download_url, ...fileVars(meta) })
      }

      const del = pathname.match(/^\/delete\/([^/]+)$/)
      if (del) {
        const id = extractFileId(decodeURIComponent(del[1]))
        if (id) await deleteFile(id)
        return redirect(urlFor('home', { lang, __keywords: true }))
      }
    }

    return new Response('Page not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  } catch (error) {
    console.error('Request failed', pathname, error)
    return new Response('Something went wrong', { status: 500 })
  }
}

export const config: Config = {
  path: ['/', '/*'],
  excludedPath: ['/static/*'],
}
