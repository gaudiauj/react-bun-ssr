# Image Component Plan

## Goal

Add a first-party `Image` component to `react-bun-ssr` with a developer experience similar to `next/image`, backed by Bun 1.3.14's `Bun.Image` server-side image processing API.

The component should optimize local/public images through the framework runtime while keeping route modules safe for browser bundles. It should render deterministic SSR markup, hydrate without mismatch, and expose a typed React API from the framework public entrypoints.

## Source Context

- Bun 1.3.14 adds `Bun.Image`, a built-in image processing pipeline for decoding, resizing, rotating, encoding, metadata, placeholder generation, and direct `Response` body integration.
- `Bun.Image` supports JPEG, PNG, WebP, GIF, and BMP on all platforms, with HEIC, AVIF, and TIFF support varying by OS.
- `Bun.Image` accepts files, blobs, buffers, typed arrays, path strings, and data URLs.
- The current package engine is `bun >=1.3.10`, and `bun-types` is pinned to `1.3.10`.
- Public framework exports currently live in `framework/runtime/index.ts` and `framework/runtime/route-api.ts`; the image component should add a dedicated package subpath instead of joining either existing entrypoint.
- Browser-safe components such as `Link` live under `framework/runtime/*.tsx` and avoid importing Bun-only APIs.

## Product Shape

### Public API

Create a component exported from its own package subpath:

```tsx
import { Image } from "react-bun-ssr/image";

export default function Page() {
  return (
    <Image
      src="/images/course-cover.jpg"
      alt="Course cover"
      width={1200}
      height={630}
      sizes="(max-width: 768px) 100vw, 50vw"
      priority
      placeholder="blur"
    />
  );
}
```

Initial props should cover the most important `next/image` behaviors without promising full parity:

- `src`: string URL/path for the first version.
- `alt`: required string.
- `width` and `height`: required unless `fill` is true.
- `fill`: absolutely fill the containing block.
- `sizes`: forwarded to `<img>`.
- `quality`: encode quality for optimized formats.
- `priority`: render eager loading and high fetch priority.
- `loading`: `"lazy"` or `"eager"`, defaulting to lazy unless `priority`.
- `placeholder`: `"empty"` or `"blur"`.
- `blurDataURL`: explicit blur placeholder override.
- `format`: `"webp" | "jpeg" | "png" | "avif"` with webp default when supported.
- `fit`: maps to `Bun.Image.resize(..., { fit })`.
- Standard safe `<img>` props: `className`, `style`, `id`, `title`, `decoding`, `fetchPriority`, `referrerPolicy`, `crossOrigin`, event handlers.

Defer these props until the core pipeline is stable:

- Static imported image objects.
- Remote image optimization.
- Custom loaders.
- Art direction with multiple source files.
- Advanced content negotiation.

## Architecture

### 1. Update Bun Baseline

- Update `package.json` `engines.bun` from `>=1.3.10` to `>=1.3.14`.
- Update `bun-types` from `1.3.10` to `1.3.14`.
- Run `bun install` so `bun.lock` and Bun's self-package snapshot are refreshed.
- Confirm the app workspace still resolves `react-bun-ssr` through the existing local link.

### 2. Browser-Safe React Component

Add `framework/runtime/image.tsx`.

Responsibilities:

- Validate prop combinations at render time:
  - `alt` is required by TypeScript.
  - `width` and `height` are required unless `fill` is true.
  - `fill` requires explicit layout styles from the caller or documented parent positioning.
- Render a plain `<img>` element with deterministic attributes during SSR and hydration.
- Build `src` and `srcSet` URLs pointing at a framework image optimization endpoint.
- Preserve existing `className`, `style`, events, and safe image attributes.
- Avoid importing `Bun.Image`, `node:path`, or file I/O helpers in this component.

Use a small internal helper such as:

```ts
function createImageUrl(options: ImageTransformOptions): string
```

The generated URL should be stable and cacheable, for example:

```text
/_rbssr/image?src=%2Fimages%2Fcourse-cover.jpg&w=640&q=75&format=webp&fit=cover
```

### 3. Server-Only Image Optimizer

Add a server-only module such as `framework/runtime/image-optimizer.server.ts`.

Responsibilities:

- Parse and validate optimizer query params.
- Only allow local public assets for the first version.
- Resolve `/foo.jpg` to the app public directory without allowing path traversal.
- Use `Bun.file(...).image()` or `new Bun.Image(...)` to:
  - read metadata when needed,
  - resize to requested width,
  - preserve aspect ratio unless a supported fit mode asks otherwise,
  - encode to webp/jpeg/png/avif,
  - generate blur placeholders when requested.
- Return `Response` objects with correct `Content-Type`, `Cache-Control`, `ETag`, and error status codes.
- Keep all Bun-only APIs out of client-importable modules.

### 4. Runtime Route Integration

Wire a reserved internal route into the request executor or server route handling before user route matching:

```text
GET /_rbssr/image
```

Behavior:

- `GET` returns the optimized image.
- `HEAD` returns equivalent headers without a body.
- Invalid params return `400`.
- Missing files return `404`.
- Unsupported media or transform failures return `415` or `422`.
- Non-local URLs return `400` until remote patterns are implemented.

Make sure this does not conflict with app route files and does not leak into route manifests as a user route.

### 5. Width Selection

Start with a conservative built-in width list similar to Next.js:

```ts
const DEFAULT_IMAGE_WIDTHS = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];
```

For fixed-size images:

- Generate `1x` and `2x` candidates based on the declared width.

For responsive images with `sizes`:

- Generate a width descriptor `srcSet` using the default width list.

Avoid layout measurement in the browser. The SSR output should contain everything the browser needs.

### 6. Placeholder Support

Support:

- `placeholder="empty"`: no special placeholder behavior.
- `placeholder="blur"` with `blurDataURL`: render CSS background blur immediately.
- `placeholder="blur"` without `blurDataURL`: plan a server/generated placeholder path.

Implementation options:

- First version: require `blurDataURL` when `placeholder="blur"` and warn in development if missing.
- Follow-up: add `/_rbssr/image-placeholder?...` or include a low-width transformed data URL generated during build/server render.

Prefer the first version unless the optimizer can generate placeholders without making component rendering async.

### 7. Configuration

Add image configuration to `FrameworkConfig` only if the first implementation needs configurable policy:

```ts
type ImageConfig = {
  widths?: number[];
  formats?: Array<"webp" | "jpeg" | "png" | "avif">;
  quality?: number;
  minimumCacheTTLSeconds?: number;
  localPatterns?: string[];
  remotePatterns?: Array<{
    protocol?: "http" | "https";
    hostname: string;
    pathname?: string;
  }>;
};
```

For the first pass, keep remote optimization out of scope even if `remotePatterns` is reserved for later.

### 8. Dedicated Package Entrypoint

Add a new runtime entrypoint:

- `framework/runtime/image.tsx`
- `framework/runtime/image-api.ts`

`framework/runtime/image-api.ts` should be the public subpath module:

```ts
export { Image, type ImageProps } from "./image";
```

Update `package.json` exports:

```json
{
  "exports": {
    "./image": {
      "types": "./framework/runtime/image-api.ts",
      "default": "./framework/runtime/image-api.ts"
    }
  }
}
```

Do not export `Image` from `react-bun-ssr` or `react-bun-ssr/route`. Keep route APIs focused on route lifecycle, navigation, and route tree hooks, and keep image optimization behind the explicit `react-bun-ssr/image` entrypoint.

Because this changes the public API, add generated API docs support for the new subpath and regenerate generated docs plus the docs search index after implementation.

### 9. Documentation

Add authored docs, likely under `app/routes/docs/styling/images.md` or `app/routes/docs/rendering/images.md`.

Cover:

- Basic usage.
- Fixed dimensions.
- Fill layout.
- Responsive `sizes`.
- Priority images.
- Blur placeholders.
- Local/public asset limitation in v1.
- How this uses Bun 1.3.14's `Bun.Image` on the server.

Update `app/routes/docs/_sidebar.ts` to include the new page.

Generated files to update after implementation:

- `app/routes/docs/api/react-bun-ssr-image.md`
- `app/routes/docs/search-index.json`
- `app/routes/docs/docs-manifest.json` if docs generation updates it.

Do not manually edit generated API docs or search artifacts.

## Testing Plan

### Unit Tests

Add tests for:

- `Image` prop validation and rendered attributes.
- `src`, `srcSet`, `sizes`, `loading`, `decoding`, and `fetchPriority` output.
- `priority` overriding lazy defaults.
- `fill` layout output.
- Query param serialization stability.
- Optimizer param parsing and path traversal rejection.

### Integration Tests

Add tests for:

- `GET /_rbssr/image` with a local public image returns `200`.
- `HEAD /_rbssr/image` returns headers without a body.
- Missing image returns `404`.
- Unsupported remote URL returns `400`.
- Invalid width/quality returns `400`.
- Optimized response has expected `Content-Type` and cache headers.
- A route rendering `<Image>` SSRs and hydrates without mismatched markup.

### Compatibility Tests

Run the existing package smoke tests to ensure the new files are included in packed output and app fixtures can import `Image` from `react-bun-ssr/image`.

## Validation Commands

Run in this order after implementation:

```bash
bun install
bun test
bun run docs:check
bun run docs:build
```

If only iterating on docs during development, also run:

```bash
bun run scripts/build-search-index.ts
bun run scripts/check-docs.ts
```

## Phased Implementation

### Phase 1: Baseline and Public Component

- Update Bun engine and `bun-types`.
- Add `framework/runtime/image.tsx`.
- Add the `react-bun-ssr/image` package export.
- Export `Image` and `ImageProps` from the dedicated image entrypoint.
- Add unit tests for prop behavior and URL generation.

### Phase 2: Local Optimizer Endpoint

- Add the server-only optimizer module.
- Wire `/_rbssr/image` before user route matching.
- Add optimizer unit and integration tests.
- Ensure no Bun-only imports enter browser bundles.

### Phase 3: Docs and Generated Artifacts

- Add authored docs page and sidebar entry.
- Regenerate API docs, docs manifest, and search index.
- Run docs checks and build.

### Phase 4: Follow-Ups

- Add remote image support with explicit allowlists.
- Add generated blur placeholders without async component rendering.
- Add static image metadata support.
- Add config-level width, format, and cache policy.
- Add content negotiation if framework config supports multiple output formats.

## Open Decisions

- Should the optimizer endpoint be configurable, or reserved as `/_rbssr/image` permanently?
- Should `placeholder="blur"` without `blurDataURL` warn in development or throw?
- Should AVIF be enabled by default even though Bun's encode support is platform-dependent?
- Should this initial version support remote images, or keep the first release strictly local for a safer security model?

## Risks

- `Bun.Image` is server-only; importing optimizer code from `image.tsx` would leak Bun runtime APIs into browser bundles.
- Remote image optimization introduces SSRF risk and should require an explicit allowlist.
- Generated blur placeholders can make render async if designed incorrectly.
- Platform-specific AVIF/HEIC/TIFF support can make tests flaky unless tests use JPEG/PNG/WebP.
- A reserved optimizer route must be matched before app routes without interfering with route manifests or user files.
