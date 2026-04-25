type Env = Record<string, never>;

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/v1/health") {
      return Response.json({
        status: "ok",
        version: "0.1.0",
        timestamp: new Date().toISOString(),
      });
    }

    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
