import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const port = Number.parseInt(process.env.NUKONUKO_PORT ?? "4173", 10);

const routes = new Map([
  ["/", ["public/index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["public/index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["public/styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["public/app.js", "text/javascript; charset=utf-8"]],
  [
    "/src/frame-analysis.js",
    ["src/frame-analysis.js", "text/javascript; charset=utf-8"],
  ],
  [
    "/src/effect-state.js",
    ["src/effect-state.js", "text/javascript; charset=utf-8"],
  ],
]);

const server = createServer((request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  const route = routes.get(pathname);

  if (!route) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not Found");
    return;
  }

  const [relativePath, contentType] = route;
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": contentType,
  });
  createReadStream(path.join(repositoryRoot, relativePath)).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Nukonuko Signal Lab: http://127.0.0.1:${port}`);
});
