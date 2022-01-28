import { getRelativePath, extname, join } from "./deps.ts"

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".glsl": "text/glsl",
  ".jpg": "image/jpeg",
  ".png": "image/png",
}

export const getContentType = (path: string): string => {
  const ext = extname(path)
  return mimeTypes[ext] || "application/octet-stream"
}

const debounceTimers = new Map()
const debounceById = (id: string, callback: () => void, delay: number) => {
  if (debounceTimers.has(id)) {
    clearTimeout(debounceTimers.get(id)!)
  }
  debounceTimers.set(id, setTimeout(() => {
    debounceTimers.delete(id)
    callback()
  }, delay))
}


export const watchListeners: Set<(path: string) => void> = new Set()
export const wathcFs = async () => {
  const w = Deno.watchFs("./app", { recursive: true })
  for await (const { kind, paths } of w) {
    if (kind === "modify") {
      const path = getRelativePath(join(Deno.cwd(), "app"), paths[0])
      if (!path.startsWith(".")) {
        debounceById(path, () => {
          watchListeners.forEach(listener => listener(`./${path}`))
        }, 50)
      }
    }
  }
}
