import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Image, createImageUrl } from "../../../framework/runtime/image";

describe("Image component", () => {
  it("creates stable optimizer URLs", () => {
    expect(createImageUrl({
      src: "/covers/course.jpg",
      width: 640,
      quality: 82,
      format: "webp",
      fit: "cover",
    })).toBe("/_rbssr/image?src=%2Fcovers%2Fcourse.jpg&w=640&q=82&format=webp&fit=cover");
  });

  it("renders fixed image attributes and density srcset", () => {
    const html = renderToStaticMarkup(
      <Image
        src="/covers/course.jpg"
        alt="Course cover"
        width={320}
        height={180}
        priority
      />,
    );

    expect(html).toContain('alt="Course cover"');
    expect(html).toContain('width="320"');
    expect(html).toContain('height="180"');
    expect(html).toContain('loading="eager"');
    expect(html).toContain('fetchPriority="high"');
    expect(html).toContain("/_rbssr/image?src=%2Fcovers%2Fcourse.jpg&amp;w=320&amp;q=75&amp;format=webp 1x");
    expect(html).toContain("/_rbssr/image?src=%2Fcovers%2Fcourse.jpg&amp;w=640&amp;q=75&amp;format=webp 2x");
  });

  it("renders responsive width srcset when sizes is provided", () => {
    const html = renderToStaticMarkup(
      <Image
        src="/hero.jpg"
        alt="Hero"
        width={640}
        height={360}
        sizes="(max-width: 768px) 100vw, 640px"
      />,
    );

    expect(html).toContain('sizes="(max-width: 768px) 100vw, 640px"');
    expect(html).toContain("w=16&amp;q=75&amp;format=webp 16w");
    expect(html).toContain("w=1200&amp;q=75&amp;format=webp 1200w");
    expect(html).not.toContain("w=1920&amp;q=75&amp;format=webp 1920w");
  });

  it("renders fill images with deterministic layout styles", () => {
    const html = renderToStaticMarkup(
      <Image
        src="/hero.jpg"
        alt="Hero"
        fill
        sizes="100vw"
        fit="cover"
        placeholder="blur"
        blurDataURL="data:image/png;base64,abc"
      />,
    );

    expect(html).toContain('sizes="100vw"');
    expect(html).toContain("position:absolute");
    expect(html).toContain("width:100%");
    expect(html).toContain("height:100%");
    expect(html).toContain("object-fit:cover");
    expect(html).toContain("background-image:url(&quot;data:image/png;base64,abc&quot;)");
  });

  it("leaves remote sources unoptimized", () => {
    const html = renderToStaticMarkup(
      <Image
        src="https://example.com/image.jpg"
        alt="Remote"
        width={100}
        height={100}
      />,
    );

    expect(html).toContain('src="https://example.com/image.jpg"');
    expect(html).not.toContain("srcSet=");
  });
});
