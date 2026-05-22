---
title: react-bun-ssr Image Component API Reference
navTitle: react-bun-ssr/image
description: Reference the dedicated Image component entrypoint for local public image optimization through Bun.Image in Bun-native React SSR apps.
section: API
order: 5
kind: api
tags: api,generated
---

# react-bun-ssr Image Component API Reference

Auto-generated from framework TypeScript exports. Do not edit manually.

Import from `react-bun-ssr/image` when you want optimized image markup backed by the framework image endpoint. This entrypoint is separate from route APIs so image rendering stays explicit and tree-shakeable.

## Examples

### Responsive local image

```tsx
import { Image } from "react-bun-ssr/image";

export default function CourseCard() {
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

### Fill layout

```tsx
import { Image } from "react-bun-ssr/image";

export default function HeroImage() {
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

## Exported symbols

## Image

- Kind: function
- Source: `framework/runtime/image.tsx`

```ts
Image(props: ImageProps): Element
```

## ImageProps

- Kind: type
- Source: `framework/runtime/image.tsx`

```ts
export type ImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "alt" | "src" | "srcSet" | "width" | "height" | "loading"
> & {
  src: string;
  alt: string;
  quality?: number;
  priority?: boolean;
  loading?: "lazy" | "eager";
  placeholder?: ImagePlaceholder;
  blurDataURL?: string;
  format?: ImageFormat;
  fit?: ImageFit;
} & (
  | {
      width: number;
      height: number;
      fill?: false;
      sizes?: string;
    }
  | {
      fill: true;
      width?: never;
      height?: never;
      sizes: string;
    }
);
```
