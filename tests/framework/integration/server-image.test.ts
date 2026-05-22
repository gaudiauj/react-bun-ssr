import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { createServer } from "../../../framework/runtime/server";
import { createFixtureApp } from "../helpers/fixture-app";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();

afterEach(async () => {
  await tempDirs.cleanup();
});

describe("Image integration", () => {
  it("renders Image from the dedicated package subpath during SSR", async () => {
    const cwd = await createFixtureApp(tempDirs, {
      "app/root.tsx": `import { Outlet } from "react-bun-ssr/route";
export default function Root() {
  return <Outlet />;
}`,
      "app/routes/index.tsx": `import { Image } from "react-bun-ssr/image";
export default function Index() {
  return (
    <Image
      src="/images/course.jpg"
      alt="Course"
      width={320}
      height={180}
      priority
    />
  );
}`,
    });

    const server = createServer({
      appDir: path.join(cwd, "app"),
      mode: "development",
    }, {
      dev: true,
      devAssets: {
        index: { script: "/__rbssr/client/route__index.js", css: [] },
      },
    });

    const response = await server.fetch(new Request("http://localhost/"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('alt="Course"');
    expect(html).toContain("/_rbssr/image?src=%2Fimages%2Fcourse.jpg");
    expect(html).toContain('fetchPriority="high"');
  });

  it("handles image optimizer validation before user routes", async () => {
    const cwd = await createFixtureApp(tempDirs, {
      "app/root.tsx": `import { Outlet } from "react-bun-ssr/route";
export default function Root() {
  return <Outlet />;
}`,
      "app/routes/index.tsx": `export default function Index() {
  return <h1>Home</h1>;
}`,
    });

    const server = createServer({
      appDir: path.join(cwd, "app"),
      mode: "development",
    }, {
      dev: true,
    });

    const invalid = await server.fetch(new Request("http://localhost/_rbssr/image?src=https%3A%2F%2Fexample.com%2Fx.jpg&w=640"));
    expect(invalid.status).toBe(400);
    expect(await invalid.text()).toContain("local public path");

    const missing = await server.fetch(new Request("http://localhost/_rbssr/image?src=%2Fmissing.jpg&w=640"));
    expect(missing.status).toBe(404);

    const method = await server.fetch(new Request("http://localhost/_rbssr/image?src=%2Fmissing.jpg&w=640", {
      method: "POST",
    }));
    expect(method.status).toBe(405);
    expect(method.headers.get("allow")).toBe("GET, HEAD");
  });
});
