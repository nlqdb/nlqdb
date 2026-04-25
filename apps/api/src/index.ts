type Env = {
  KV: KVNamespace;
  DB: D1Database;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/v1/health") {
      return Response.json({
        status: "ok",
        version: "0.1.0",
        timestamp: new Date().toISOString(),
        bindings: {
          kv: typeof env.KV !== "undefined",
          db: typeof env.DB !== "undefined",
        },
      });
    }

    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
