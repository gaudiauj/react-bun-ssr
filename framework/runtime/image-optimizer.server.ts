import path from "node:path";
import { statPath } from "./io";
import type { ResolvedConfig } from "./types";
import { ensureWithin, stableHash } from "./utils";

type ImageFit = "contain" | "cover" | "fill" | "inside" | "outside";
type ImageFormat = "webp" | "jpeg" | "png" | "avif";

interface ParsedImageRequest {
  src: string;
  width: number;
  quality: number;
  format: ImageFormat;
  fit?: ImageFit;
}

type BunImagePipeline = {
  resize(width: number, height?: number, options?: { fit?: ImageFit; withoutEnlargement?: boolean }): BunImagePipeline;
  webp(options?: { quality?: number }): unknown;
  jpeg(options?: { quality?: number }): unknown;
  png(options?: { compressionLevel?: number }): unknown;
  avif(options?: { quality?: number }): unknown;
};

const IMAGE_ROUTE_PATH = "/_rbssr/image";
const ALLOWED_FORMATS = new Set<ImageFormat>(["webp", "jpeg", "png", "avif"]);
const ALLOWED_FITS = new Set<ImageFit>(["contain", "cover", "fill", "inside", "outside"]);
const ONE_YEAR_SECONDS = 31_536_000;

function badRequest(message: string): Response {
  return new Response(message, {
    status: 400,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function parsePositiveInt(value: string | null, name: string): number | Response {
  if (value === null || value.trim() === "") {
    return badRequest(`Missing \`${name}\` parameter.`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return badRequest(`Invalid \`${name}\` parameter.`);
  }
  return parsed;
}

export function isImageOptimizerRequest(url: URL): boolean {
  return url.pathname === IMAGE_ROUTE_PATH;
}

export function parseImageOptimizerRequest(url: URL): ParsedImageRequest | Response {
  const src = url.searchParams.get("src");
  if (!src || !src.startsWith("/") || src.startsWith("//") || src.startsWith("/_rbssr/")) {
    return badRequest("Image `src` must be a local public path.");
  }

  const width = parsePositiveInt(url.searchParams.get("w"), "w");
  if (width instanceof Response) {
    return width;
  }

  const parsedQuality = url.searchParams.get("q") === null
    ? 75
    : parsePositiveInt(url.searchParams.get("q"), "q");
  if (parsedQuality instanceof Response) {
    return parsedQuality;
  }
  if (parsedQuality > 100) {
    return badRequest("Image `q` must be between 1 and 100.");
  }

  const rawFormat = url.searchParams.get("format") ?? "webp";
  if (!ALLOWED_FORMATS.has(rawFormat as ImageFormat)) {
    return badRequest("Unsupported image `format` parameter.");
  }

  const rawFit = url.searchParams.get("fit");
  if (rawFit !== null && !ALLOWED_FITS.has(rawFit as ImageFit)) {
    return badRequest("Unsupported image `fit` parameter.");
  }

  return {
    src,
    width,
    quality: parsedQuality,
    format: rawFormat as ImageFormat,
    fit: rawFit === null ? undefined : rawFit as ImageFit,
  };
}

function resolvePublicImagePath(publicDir: string, src: string): string | null {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(src);
  } catch {
    return null;
  }
  return ensureWithin(publicDir, decodedPath.replace(/^\/+/, ""));
}

function toImageResponseBody(pipeline: BunImagePipeline, options: ParsedImageRequest): unknown {
  const resized = pipeline.resize(options.width, undefined, {
    fit: options.fit ?? "inside",
    withoutEnlargement: true,
  });

  if (options.format === "jpeg") {
    return resized.jpeg({ quality: options.quality });
  }
  if (options.format === "png") {
    return resized.png();
  }
  if (options.format === "avif") {
    return resized.avif({ quality: options.quality });
  }
  return resized.webp({ quality: options.quality });
}

export async function handleImageOptimizerRequest(options: {
  request: Request;
  url: URL;
  config: ResolvedConfig;
}): Promise<Response> {
  const method = options.request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        allow: "GET, HEAD",
      },
    });
  }

  const parsed = parseImageOptimizerRequest(options.url);
  if (parsed instanceof Response) {
    return parsed;
  }

  const imagePath = resolvePublicImagePath(options.config.publicDir, parsed.src);
  if (!imagePath) {
    return badRequest("Image `src` must stay within the public directory.");
  }

  const stat = await statPath(imagePath);
  if (!stat?.isFile()) {
    return new Response("Image not found.", { status: 404 });
  }

  try {
    const file = Bun.file(imagePath) as unknown as { image(): BunImagePipeline };
    const body = toImageResponseBody(file.image(), parsed);
    const headers = new Headers({
      "cache-control": `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
      etag: `"${stableHash(`${path.relative(options.config.publicDir, imagePath)}:${stat.size}:${stat.mtimeMs}:${JSON.stringify(parsed)}`)}"`,
      vary: "Accept",
    });

    return new Response(method === "HEAD" ? null : body as BodyInit, {
      headers,
    });
  } catch (error) {
    return new Response(
      process.env.NODE_ENV === "production"
        ? "Image optimization failed."
        : `Image optimization failed: ${error instanceof Error ? error.message : Bun.inspect(error)}`,
      {
        status: 422,
        headers: {
          "content-type": "text/plain; charset=utf-8",
        },
      },
    );
  }
}
