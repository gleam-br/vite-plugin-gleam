import { existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ViteDevServer } from "vite";
import type { GleamProject, GleamPlugin } from "./project";

export function setupMockApi(
  server: ViteDevServer,
  project: GleamProject,
  options: GleamPlugin["mock"]
): void {
  if (!options) return;

  const dir = options.dir || "./mock";
  const prefix = options.prefix || "/api";
  const { cwd } = project.dir;
  const mockDir = resolve(cwd, dir);

  if (!existsSync(mockDir)) {
    project.log(`[mock] Directory not found: ${mockDir}`, true);
    return;
  }

  project.log(`[mock] Initializing mock server from ${mockDir}`);
  project.log(`[mock] Prefix intercept: ${prefix}`);

  // Load all mock definitions
  let mockData: Record<string, any> = {};

  const loadMocks = async () => {
    mockData = {};
    const files = readdirSync(mockDir).filter((f) => f.endsWith(".js") || f.endsWith(".mjs") || f.endsWith(".ts"));
    for (const file of files) {
      const filePath = join(mockDir, file);
      try {
        // Bust cache to allow hot reloading of mock files
        const fileUrl = pathToFileURL(filePath).href;
        const moduleUrl = `${fileUrl}?t=${Date.now()}`;
        const mod = await import(moduleUrl);
        const data = mod.default || mod;
        Object.assign(mockData, data);
      } catch (err: any) {
        project.log(`[mock] Error loading ${file}: ${err.message}`, true);
      }
    }
  };

  // Initial load
  loadMocks();

  // Watch mock files for changes
  server.watcher.add(mockDir);
  server.watcher.on("change", async (path) => {
    if (path.startsWith(mockDir)) {
      project.log(`[mock] File changed, reloading mocks...`);
      await loadMocks();
    }
  });

  server.middlewares.use((req, res, next) => {
    if (!req.url) return next();

    let urlPath = req.url.split("?")[0];

    // Intercept with prefix
    if (urlPath != undefined && urlPath.startsWith(prefix)) {
      urlPath = urlPath.replace(prefix, "");
    } else {
      // Not a mock route
      return next();
    }

    const method = req.method;
    const routeKey = `${method} ${urlPath}`;

    // Static mock data check
    if (mockData[routeKey]) {
      project.log(`[mock] Intercepting: ${routeKey}`);
      res.setHeader("Content-Type", "application/json");

      // Check if it's a function (dynamic mock)
      if (typeof mockData[routeKey] === "function") {
        return mockData[routeKey](req, res);
      }

      // Return static data with a bit of latency
      setTimeout(() => {
        res.end(JSON.stringify(mockData[routeKey]));
      }, 300);
      return;
    }

    // Dynamic pattern matching can be added here
    // Ex: POST /properties -> handled by mockData['POST /properties']

    // If we have a prefix match but no route, maybe it's meant to be 404
    project.log(`[mock] Not found in mock: ${routeKey}`, true);
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Mock route not found" }));
  });
}
