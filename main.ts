import { serve, getContentType, getRelativePath, util } from "./deps.ts"

const DEPLOY = Deno.env.get("DENO_DEPLOYMENT_ID")

const watchListeners: Set<(path: string) => void> = new Set()
const wathcFs = async () => {
  const w = Deno.watchFs(".", { recursive: true })
  for await (const { kind, paths } of w) {
    if (kind === "modify") {
      const path = getRelativePath(Deno.cwd(), paths[0])
      if (path !== "main.ts" && !path.startsWith(".")) {
        util.debounceById(path, () => {
          watchListeners.forEach(listener => listener(`./${path}`))
        }, 50)
      }
    }
  }
}

if (!DEPLOY) {
  wathcFs()
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)

  switch (url.pathname) {
    case "/dev-socket":
      const { response, socket } = Deno.upgradeWebSocket(req)
      const listerner = (path: string) => {
        if (/.(html|jsx?|tsx?|css)$/.test(path)) {
          socket.send("RELOAD")
        } else if (path.endsWith(".glsl")) {
          socket.send("REDRAW")
        }
      }
      socket.addEventListener("message", (e) => {
        if (e.data === "READY") {
          watchListeners.add(listerner)
        }
      })
      socket.addEventListener("close", () => {
        watchListeners.delete(listerner)
      })
      return response
    default:
      const filepath = `./${url.pathname.slice(1) || "index.html"}`
      try {
        if (filepath === "./index.html") {
          let indexHtml = await Deno.readTextFile(filepath)
          if (DEPLOY) {
            indexHtml = indexHtml.replace("</head>", "  <script>DEPLOY='${DEPLOY}'</script>\n</head>")
            indexHtml = indexHtml.replace(/\.(js|css)"/g, `.$1?v=${DEPLOY}"`)
          } else {
            indexHtml = indexHtml.replace("</head>", "  <script>IS_DEV=true</script>\n</head>")
          }
          return new Response(indexHtml, {
            headers: {
              "Content-Type": "text/html charset=utf-8",
              "Cache-Control": "public, max-age=0, must-revalidate",
            }
          })
        } else {
          const file = await Deno.readFile(filepath)
          const headers = new Headers({ "Content-Type": getContentType(filepath) })
          if (url.searchParams.has("v")) {
            headers.set("Cache-Control", "public, max-age=31536000, immutable")
          }
          return new Response(file, { headers })
        }
      } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
          return new Response("Not Found", { status: 404 })
        }
        return new Response("Internal Server Error", { status: 500 })
      }
  }
}

console.log("Listening on http://localhost:8000")
await serve(handler)
