import type { CSSProperties, ImgHTMLAttributes } from "react";

type ImageFit = "contain" | "cover" | "fill" | "inside" | "outside";
type ImageFormat = "webp" | "jpeg" | "png" | "avif";
type ImagePlaceholder = "empty" | "blur";

export interface ImageTransformOptions {
  src: string;
  width: number;
  quality?: number;
  format?: ImageFormat;
  fit?: ImageFit;
}

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

const DEFAULT_QUALITY = 75;
const DEFAULT_FORMAT: ImageFormat = "webp";
export const DEFAULT_IMAGE_WIDTHS = [
  16,
  32,
  48,
  64,
  96,
  128,
  256,
  384,
  640,
  750,
  828,
  1080,
  1200,
  1920,
  2048,
  3840,
] as const;

function clampQuality(quality: number | undefined): number {
  if (quality === undefined || !Number.isFinite(quality)) {
    return DEFAULT_QUALITY;
  }
  return Math.min(100, Math.max(1, Math.round(quality)));
}

function isLocalOptimizableSrc(src: string): boolean {
  return src.startsWith("/") && !src.startsWith("//") && !src.startsWith("/_rbssr/");
}

function toNearestWidths(width: number): number[] {
  const normalized = Math.max(1, Math.round(width));
  const widths = new Set([normalized, normalized * 2]);
  return [...widths];
}

function toResponsiveWidths(width?: number): number[] {
  if (width === undefined) {
    return [...DEFAULT_IMAGE_WIDTHS];
  }
  const maxWidth = Math.max(1, Math.round(width * 2));
  const widths = DEFAULT_IMAGE_WIDTHS.filter(candidate => candidate <= maxWidth);
  return widths.length > 0 ? widths : [Math.max(1, Math.round(width))];
}

export function createImageUrl(options: ImageTransformOptions): string {
  const params = new URLSearchParams();
  params.set("src", options.src);
  params.set("w", String(Math.max(1, Math.round(options.width))));
  params.set("q", String(clampQuality(options.quality)));
  params.set("format", options.format ?? DEFAULT_FORMAT);
  if (options.fit) {
    params.set("fit", options.fit);
  }
  return `/_rbssr/image?${params.toString()}`;
}

function toStyle(options: {
  fill: boolean;
  fit?: ImageFit;
  placeholder?: ImagePlaceholder;
  blurDataURL?: string;
  style?: CSSProperties;
}): CSSProperties | undefined {
  const style: CSSProperties = { ...options.style };

  if (options.fill) {
    style.position ??= "absolute";
    style.inset ??= 0;
    style.width ??= "100%";
    style.height ??= "100%";
  }

  if (options.fit && options.fit !== "inside" && options.fit !== "outside") {
    style.objectFit ??= options.fit;
  }

  if (options.placeholder === "blur" && options.blurDataURL) {
    style.backgroundImage ??= `url("${options.blurDataURL}")`;
    style.backgroundSize ??= "cover";
    style.backgroundPosition ??= "center";
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

export function Image(props: ImageProps) {
  const {
    src,
    alt,
    quality,
    priority = false,
    loading,
    placeholder = "empty",
    blurDataURL,
    format,
    fit,
    fill: fillProp,
    sizes,
    style,
    decoding,
    fetchPriority,
    ...rest
  } = props;

  const fill = fillProp === true;
  const width = fill ? undefined : props.width;
  const height = fill ? undefined : props.height;
  const optimized = isLocalOptimizableSrc(src);
  const resolvedLoading = loading ?? (priority ? "eager" : "lazy");
  const resolvedDecoding = decoding ?? (priority ? "sync" : "async");
  const resolvedFetchPriority = fetchPriority ?? (priority ? "high" : undefined);
  const widths = sizes ? toResponsiveWidths(width) : toNearestWidths(width ?? 384);
  const srcSet = optimized
    ? widths
        .map(candidateWidth => {
          const url = createImageUrl({
            src,
            width: candidateWidth,
            quality,
            format,
            fit,
          });
          return sizes ? `${url} ${candidateWidth}w` : `${url} ${candidateWidth / (width ?? candidateWidth)}x`;
        })
        .join(", ")
    : undefined;
  const renderedSrc = optimized
    ? createImageUrl({
        src,
        width: widths[0] ?? width ?? 384,
        quality,
        format,
        fit,
      })
    : src;

  if (process.env.NODE_ENV !== "production" && placeholder === "blur" && !blurDataURL) {
    // eslint-disable-next-line no-console
    console.warn("[react-bun-ssr/image] placeholder=\"blur\" requires `blurDataURL` in the first Image implementation.");
  }

  return (
    <img
      {...rest}
      alt={alt}
      decoding={resolvedDecoding}
      fetchPriority={resolvedFetchPriority}
      height={height}
      loading={resolvedLoading}
      sizes={sizes}
      src={renderedSrc}
      srcSet={srcSet}
      style={toStyle({
        fill,
        fit,
        placeholder,
        blurDataURL,
        style,
      })}
      width={width}
    />
  );
}
