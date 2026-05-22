export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const { default: handler } = await import(
      "@tanstack/react-start/server-entry"
    );
    const h = (handler as any).default ?? handler;
    return h.fetch(request, env, ctx);
  },
};
