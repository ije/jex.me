import { serve } from "https://deno.land/x/aleph_canary@0.0.4/server/mod.ts";

serve({
  fetch: async (req) => {
    const { pathname } = new URL(req.url);
    if (pathname === "/fs/src/world.glsl") {
      const stat = await Deno.lstat("./src/world.glsl");
      return new Response(JSON.stringify(stat), {
        headers: { "content-type": "application/json" },
      });
    }
    if (pathname.startsWith("/fs/")) {
      const list: Deno.DirEntry[] = [];
      for await (const e of Deno.readDir(pathname.slice(4) || ".")) {
        list.push(e);
      }
      return new Response(JSON.stringify(list), {
        headers: { "content-type": "application/json" },
      });
    }
  },
});
