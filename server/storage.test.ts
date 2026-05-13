import fs from "fs/promises";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { getLocalStorageRoot, readStorageJson, storagePut } from "./storage";

const originalForgeApiUrl = ENV.forgeApiUrl;
const originalForgeApiKey = ENV.forgeApiKey;

async function cleanupTestUploads() {
  await fs.rm(path.join(getLocalStorageRoot(), "test"), { recursive: true, force: true });
}

afterEach(async () => {
  ENV.forgeApiUrl = originalForgeApiUrl;
  ENV.forgeApiKey = originalForgeApiKey;
  vi.restoreAllMocks();
  await cleanupTestUploads();
});

describe("Storage response parsing", () => {
  it("parses JSON storage responses", async () => {
    const response = new Response(JSON.stringify({ url: "https://example.com/file.html" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    await expect(readStorageJson(response, "upload")).resolves.toEqual({
      url: "https://example.com/file.html",
    });
  });

  it("reports non-JSON HTML responses without leaking JSON parser errors", async () => {
    const response = new Response("<!doctype html><html><body>Not Found</body></html>", {
      status: 200,
      statusText: "OK",
      headers: { "content-type": "text/html" },
    });

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

describe("Storage fallback", () => {
  it("writes files locally when storage proxy credentials are not configured", async () => {
    ENV.forgeApiUrl = "";
    ENV.forgeApiKey = "";

    const result = await storagePut("test/no-config/file.txt", "hello", "text/plain");

    await expect(
      fs.readFile(path.join(getLocalStorageRoot(), "test/no-config/file.txt"), "utf8")
    ).resolves.toBe("hello");
    expect(result).toEqual({
      key: "test/no-config/file.txt",
      url: "/uploads/test/no-config/file.txt",
    });
  });

  it("falls back to local storage when the proxy returns the app HTML shell", async () => {
    ENV.forgeApiUrl = "http://localhost:3000";
    ENV.forgeApiKey = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<!doctype html><title>Система управления договорами</title>", {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "text/html" },
      })
    );

    const result = await storagePut("test/html-fallback/file.pdf", Buffer.from("pdf"), "application/pdf");

    await expect(
      fs.readFile(path.join(getLocalStorageRoot(), "test/html-fallback/file.pdf"), "utf8")
    ).resolves.toBe("pdf");
    expect(result).toEqual({
      key: "test/html-fallback/file.pdf",
      url: "/uploads/test/html-fallback/file.pdf",
    });
  });
});
