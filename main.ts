import { serve, getContentType } from "./deps.ts"

const VER = 0

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)

  switch (url.pathname) {
    case "/dev-socket":
      const { response, socket } = Deno.upgradeWebSocket(req)
      return response
    default:
      const filepath = `./${url.pathname.slice(1) || "index.html"}`
      try {
        if (filepath === "./index.html") {
          let indexHtml = await Deno.readTextFile(filepath)
          indexHtml = indexHtml.replace("VER=0", `VER=${VER}`)
          if (!Deno.env.get("DENO_DEPLOYMENT_ID")) {
            indexHtml = indexHtml.replace("IS_DEV=false", "IS_DEV=true")
          }
          return new Response(indexHtml, { headers: { "Content-Type": "text/html charset=utf-8" } })
        } else {
          const file = await Deno.readFile(filepath)
          return new Response(file, { headers: { "Content-Type": getContentType(filepath) } })
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
