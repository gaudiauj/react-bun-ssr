---
title: Optimized Images for Bun React SSR Apps
navTitle: Images
description: Render local public images with the dedicated react-bun-ssr Image component and Bun.Image-backed optimization in Bun React SSR apps.
section: Styling
order: 4
kind: guide
tags: images,assets,optimization,bun-image
---

# Images

Use `Image` from `react-bun-ssr/image` when you want framework-managed markup and server-side image optimization for files in `app/public`.

```tsx
import { Image } from "react-bun-ssr/image";

export default function CoursePage() {
  return (
    <Image
      src="/images/course-cover.jpg"
      alt="Course cover"
      width={1200}
      height={630}
      sizes="(max-width: 768px) 100vw, 50vw"
      priority
    />
  );
}
```

The component renders deterministic `<img>` markup during SSR. Local public image URLs are rewritten to the internal optimizer endpoint, which uses Bun 1.3.14's `Bun.Image` API on the server.

## Fixed images

Pass `width` and `height` for normal image layout.

```tsx
import { Image } from "react-bun-ssr/image";

export function Avatar() {
  return (
    <Image
      src="/images/team/ada.jpg"
      alt="Ada Lovelace"
      width={128}
      height={128}
    />
  );
}
```

Fixed images generate density candidates for high-resolution displays.

## Responsive images

Add `sizes` when the image's rendered width changes across breakpoints.

```tsx
import { Image } from "react-bun-ssr/image";

export function ArticleHero() {
  return (
    <Image
      src="/images/article-hero.jpg"
      alt="Article hero"
      width={1600}
      height={900}
      sizes="(max-width: 900px) 100vw, 900px"
    />
  );
}
```

Responsive images generate width candidates so the browser can choose the best source.

## Fill layout

Use `fill` when a parent owns the image box.

```tsx
import { Image } from "react-bun-ssr/image";

export function Hero() {
  return (
    <div style={{ position: "relative", aspectRatio: "16 / 9" }}>
      <Image
        src="/images/hero.jpg"
        alt="Hero"
        fill
        sizes="100vw"
        fit="cover"
      />
    </div>
  );
}
```

The parent should establish a stable size with CSS such as `position: relative`, `aspect-ratio`, width, and height constraints.

## Priority images

Use `priority` for the page's main above-the-fold image.

```tsx
<Image
  src="/images/launch.jpg"
  alt="Launch screen"
  width={1440}
  height={810}
  priority
/>
```

Priority images render eager loading, synchronous decoding, and high fetch priority.

## Blur placeholders

The first implementation supports explicit blur data URLs:

```tsx
<Image
  src="/images/course-cover.jpg"
  alt="Course cover"
  width={1200}
  height={630}
  placeholder="blur"
  blurDataURL="data:image/png;base64,..."
/>
```

Generated blur placeholders can be added later without making component rendering asynchronous.

## Current limits

- Optimized sources must be local root-relative paths under `app/public`.
- Remote image optimization is intentionally out of scope.
- Static imported image metadata is not supported yet.

## Related APIs

- [`Image`](/docs/api/react-bun-ssr-image)
- [`ImageProps`](/docs/api/react-bun-ssr-image)

## Next step

Continue with [Build Output](/docs/tooling/build-output) to see how public assets are copied into production output.
