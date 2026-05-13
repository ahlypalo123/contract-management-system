// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>) and
// falls back to local disk storage for standalone/local deployments.

import fs from "fs/promises";
import path from "path";
import { ENV } from "./_core/env";

type StorageConfig = { baseUrl: string; apiKey: string };
type StoragePayload = { url?: unknown; message?: unknown; error?: unknown };

const localStorageRoot = path.resolve(process.cwd(), "uploads");
const localStorageUrlPrefix = "/uploads";

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  const payload = await readStorageJson(response, "download URL");
  return getStorageUrl(payload, "download URL");
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

function formatStoragePayloadError(payload: StoragePayload): string {
  const message = payload.message ?? payload.error;
  if (typeof message === "string" && message.trim()) return message;

  return JSON.stringify(payload);
}

function formatResponseSnippet(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 200) || "<empty response>";
}

function isLocalForgeUrl(baseUrl: string): boolean {
  try {
    const { hostname } = new URL(baseUrl);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0"
    );
  } catch {
    return false;
  }
}

function shouldFallbackToLocalStorage(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  return error.message.includes("returned non-JSON response");
}

function buildLocalStorageUrl(key: string): string {
  return `${localStorageUrlPrefix}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function getLocalStorageRoot(): string {
  return localStorageRoot;
}

async function storagePutLocal(
  relKey: string,
  data: Buffer | Uint8Array | string
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const filePath = path.resolve(localStorageRoot, key);
  const relativePath = path.relative(localStorageRoot, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid storage key");
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);

  return { key, url: buildLocalStorageUrl(key) };
}

export async function readStorageJson(
  response: Response,
  operation: string
): Promise<StoragePayload> {
  const text = await response.text();
  let payload: StoragePayload;

  try {
    payload = text ? (JSON.parse(text) as StoragePayload) : {};
  } catch {
    throw new Error(
      `Storage ${operation} returned non-JSON response (${response.status} ${response.statusText}): ${formatResponseSnippet(text)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Storage ${operation} failed (${response.status} ${response.statusText}): ${formatStoragePayloadError(payload)}`
    );
  }

  return payload;
}

function getStorageUrl(payload: StoragePayload, operation: string): string {
  if (typeof payload.url === "string" && payload.url.trim()) {
    return payload.url;
  }

  throw new Error(`Storage ${operation} response does not include a valid url`);
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const { baseUrl, apiKey } = getStorageConfig();

  if (isLocalForgeUrl(baseUrl)) {
    console.warn(
      "Storage proxy points to the local app; saving file to local storage instead."
    );
    return await storagePutLocal(key, data);
  }

  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  try {
    const payload = await readStorageJson(response, "upload");
    return { key, url: getStorageUrl(payload, "upload") };
  } catch (error) {
    if (shouldFallbackToLocalStorage(error)) {
      console.warn(
        `${error instanceof Error ? error.message : "Storage proxy returned an invalid response"}. Saving file to local storage instead.`
      );
      return await storagePutLocal(key, data);
    }

    throw error;
  }
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);

  if (isLocalForgeUrl(baseUrl)) {
    return { key, url: buildLocalStorageUrl(key) };
  }

  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}
