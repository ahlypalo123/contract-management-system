import { describe, expect, it } from "vitest";
import { readStorageJson } from "./storage";

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
