import { join } from "node:path";
import { readFile } from "node:fs/promises";

let serverModule;

async function getServer() {
  if (!serverModule) {
    const serverPath = join(process.cwd(), "dist", "server", "server.js");
    serverModule = await import(serverPath);
  }
  return serverModule.default;
}

export default async function handler(req, res) {
  try {
    const server = await getServer();

    // Convert Node.js IncomingMessage to Web Request
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const url = new URL(req.url, `${protocol}://${host}`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }

    const body =
      req.method !== "GET" && req.method !== "HEAD"
        ? await new Promise((resolve) => {
            const chunks = [];
            req.on("data", (c) => chunks.push(c));
            req.on("end", () => resolve(Buffer.concat(chunks)));
          })
        : undefined;

    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body,
      duplex: "half",
    });

    const response = await server.fetch(request, {}, {});

    // Convert Web Response back to Node.js response
    res.status(response.status);
    for (const [key, value] of response.headers.entries()) {
      res.setHeader(key, value);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    res.end(buffer);
  } catch (error) {
    console.error("Server handler error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
