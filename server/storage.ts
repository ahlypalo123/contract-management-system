// Storage helpers for contract files.
// Prefer the configured Forge storage proxy, but fall back to local filesystem
// storage so development/local deployments keep working without proxy support.

import fs from "fs/promises";
import path from "path";
import { ENV } from './_core/env';

type StorageConfig = { baseUrl: string; apiKey: string };
type StoragePayload = { url?: unknown; message?: unknown; error?: unknown };

const LOCAL_STORAGE_URL_PREFIX = "/uploads";

function getStorageConfig(): StorageConfig | null {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    return null;
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

export function getLocalStorageRoot(): string {
  return path.resolve(process.cwd(), ".data", "uploads");
}

function buildLocalStorageUrl(key: string): string {
  return `${LOCAL_STORAGE_URL_PREFIX}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function writeLocalFile(
  key: string,
  data: Buffer | Uint8Array | string
): Promise<{ key: string; url: string }> {
  const filePath = path.join(getLocalStorageRoot(), key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);
  return { key, url: buildLocalStorageUrl(key) };
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
  return relKey
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
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

export async function readStorageJson(response: Response, operation: string): Promise<StoragePayload> {
  const text = await response.text();
  let payload: StoragePayload;

  try {
    payload = text ? JSON.parse(text) as StoragePayload : {};
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
  const config = getStorageConfig();

  const payload = await readStorageJson(response, "upload");
  return { key, url: getStorageUrl(payload, "upload") };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const key = normalizeKey(relKey);
  const config = getStorageConfig();

  if (!config) {
    return { key, url: buildLocalStorageUrl(key) };
  }

  try {
    return {
      key,
      url: await buildDownloadUrl(config.baseUrl, key, config.apiKey),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Storage] Falling back to local file URL for ${key}: ${message}`);
    return { key, url: buildLocalStorageUrl(key) };
  }
}
