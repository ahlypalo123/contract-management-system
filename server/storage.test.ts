import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import { ENV } from "./_core/env";
import { getLocalStorageRoot, readStorageJson, storagePut } from "./storage";

describe("Storage response parsing", () => {
  it("parses JSON storage responses", async () => {
    const response = new Response(
      JSON.stringify({ url: "https://example.com/file.html" }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );

    await expect(readStorageJson(response, "upload")).resolves.toEqual({
      url: "https://example.com/file.html",
    });
  });

  it("reports non-JSON HTML responses without leaking JSON parser errors", async () => {
    const response = new Response(
      "<!doctype html><html><body>Not Found</body></html>",
      {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "text/html" },
      }
    );

    await expect(readStorageJson(response, "upload")).rejects.toThrow(
      "Storage upload returned non-JSON response (200 OK): <!doctype html>"
    );
  });

  it("uses storage JSON error messages for failed responses", async () => {
    const response = new Response(JSON.stringify({ message: "bad token" }), {
      status: 401,
      statusText: "Unauthorized",
      headers: { "content-type": "application/json" },
    });

    await expect(readStorageJson(response, "upload")).rejects.toThrow(
      "Storage upload failed (401 Unauthorized): bad token"
    );
  });
});

describe("Storage local fallback", () => {
  const originalForgeApiUrl = ENV.forgeApiUrl;
  const originalForgeApiKey = ENV.forgeApiKey;
  const testKey = "test/storage-fallback.txt";
  const testFilePath = path.join(getLocalStorageRoot(), testKey);

  afterEach(async () => {
    ENV.forgeApiUrl = originalForgeApiUrl;
    ENV.forgeApiKey = originalForgeApiKey;
    vi.unstubAllGlobals();
    await fs.rm(path.dirname(testFilePath), { recursive: true, force: true });
  });

  it("stores files locally when the configured forge URL points to the app itself", async () => {
    ENV.forgeApiUrl = "http://localhost:3000";
    ENV.forgeApiKey = "local-api-key";

    const result = await storagePut(testKey, "file contents", "text/plain");

    await expect(fs.readFile(testFilePath, "utf8")).resolves.toBe(
      "file contents"
    );
    expect(result).toEqual({
      key: testKey,
      url: "/uploads/test/storage-fallback.txt",
    });
  });

  it("falls back to local storage when the proxy responds with HTML", async () => {
    ENV.forgeApiUrl = "https://forge.example.com";
    ENV.forgeApiKey = "forge-api-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<!doctype html><html></html>", {
            status: 200,
            statusText: "OK",
          })
      )
    );

    const result = await storagePut(
      testKey,
      Buffer.from("proxy fallback"),
      "text/plain"
    );

    await expect(fs.readFile(testFilePath, "utf8")).resolves.toBe(
      "proxy fallback"
    );
    expect(result).toEqual({
      key: testKey,
      url: "/uploads/test/storage-fallback.txt",
    });
  });
});
