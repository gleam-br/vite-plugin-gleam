import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { setupMockApi } from "../src/mock";
import { normalizePath } from "../src/util";
import type { GleamProject } from "../src/project";

describe("mock.ts", () => {
  const tmpDir = normalizePath(resolve("./tests/tmp_mock"));

  const fakeProject: GleamProject = {
    bin: "gleam",
    cfg: {
      name: "sample_pkg",
      version: "0.1.0",
      target: "javascript",
    },
    log: () => {},
    dir: {
      cwd: tmpDir,
      src: `${tmpDir}/src`,
      out: `${tmpDir}/build/dev/javascript`,
    },
    build: {
      noPrintProgress: true,
      warningsAsErrors: false,
    },
  };

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(`${tmpDir}/mock`, { recursive: true });
    
    // Create a dummy mock file
    const mockContent = `
      export default {
        "GET /users": [{ id: 1, name: "Alice" }],
        "POST /users": (req, res) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true }));
        }
      };
    `;
    writeFileSync(`${tmpDir}/mock/api.js`, mockContent);
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should register middlewares and watch mock dir", async () => {
    const watcherAdd = vi.fn();
    const watcherOn = vi.fn();
    const useMiddleware = vi.fn();

    const server: any = {
      watcher: {
        add: watcherAdd,
        on: watcherOn,
      },
      middlewares: {
        use: useMiddleware,
      },
    };

    setupMockApi(server, fakeProject, { dir: "./mock", prefix: "/api" });

    // Wait a tiny bit for the async dynamic import of mock files to complete
    await new Promise(r => setTimeout(r, 50));

    // Watcher should be configured
    expect(watcherAdd).toHaveBeenCalledWith(resolve(tmpDir, "./mock"));
    expect(watcherOn).toHaveBeenCalledWith("change", expect.any(Function));

    // Middleware should be registered
    expect(useMiddleware).toHaveBeenCalledWith(expect.any(Function));
  });

  it("should intercept valid mock requests", async () => {
    const server: any = {
      watcher: { add: vi.fn(), on: vi.fn() },
      middlewares: { use: vi.fn() },
    };

    setupMockApi(server, fakeProject, { dir: "./mock", prefix: "/api" });
    await new Promise(r => setTimeout(r, 50));

    const middleware = server.middlewares.use.mock.calls[0][0];

    // Test GET /api/users
    let responseData = "";
    const resGet: any = {
      setHeader: vi.fn(),
      end: (data: string) => { responseData = data; },
    };
    const nextGet = vi.fn();

    middleware({ url: "/api/users", method: "GET" }, resGet, nextGet);

    // setTimeout is used in mock.ts for static returns
    await new Promise(r => setTimeout(r, 350));
    
    expect(nextGet).not.toHaveBeenCalled();
    expect(resGet.setHeader).toHaveBeenCalledWith("Content-Type", "application/json");
    expect(JSON.parse(responseData)).toEqual([{ id: 1, name: "Alice" }]);

    // Test POST /api/users (dynamic function)
    let postResponseData = "";
    const resPost: any = {
      setHeader: vi.fn(),
      end: (data: string) => { postResponseData = data; },
    };
    const nextPost = vi.fn();

    middleware({ url: "/api/users", method: "POST" }, resPost, nextPost);
    
    expect(nextPost).not.toHaveBeenCalled();
    expect(resPost.setHeader).toHaveBeenCalledWith("Content-Type", "application/json");
    expect(JSON.parse(postResponseData)).toEqual({ success: true });
  });

  it("should call next() for non-mock routes", async () => {
    const server: any = {
      watcher: { add: vi.fn(), on: vi.fn() },
      middlewares: { use: vi.fn() },
    };

    setupMockApi(server, fakeProject, { dir: "./mock", prefix: "/api" });
    await new Promise(r => setTimeout(r, 50));

    const middleware = server.middlewares.use.mock.calls[0][0];
    const next = vi.fn();

    // Route outside prefix
    middleware({ url: "/assets/style.css", method: "GET" }, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should return 404 for valid prefix but missing route", async () => {
    const server: any = {
      watcher: { add: vi.fn(), on: vi.fn() },
      middlewares: { use: vi.fn() },
    };

    setupMockApi(server, fakeProject, { dir: "./mock", prefix: "/api" });
    await new Promise(r => setTimeout(r, 50));

    const middleware = server.middlewares.use.mock.calls[0][0];
    const res: any = {
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    const next = vi.fn();

    middleware({ url: "/api/missing", method: "GET" }, res, next);
    
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ error: "Mock route not found" }));
  });
});
