import { describe, expect, it } from "bun:test";
import {
  isImageOptimizerRequest,
  parseImageOptimizerRequest,
} from "../../../framework/runtime/image-optimizer.server";

function parsed(pathname: string) {
  return parseImageOptimizerRequest(new URL(`http://localhost${pathname}`));
}

describe("image optimizer request parsing", () => {
  it("recognizes the reserved optimizer route", () => {
    expect(isImageOptimizerRequest(new URL("http://localhost/_rbssr/image"))).toBe(true);
    expect(isImageOptimizerRequest(new URL("http://localhost/_rbssr/action"))).toBe(false);
  });

  it("parses valid local image transforms", () => {
    expect(parsed("/_rbssr/image?src=%2Fhero.jpg&w=640&q=80&format=webp&fit=cover")).toEqual({
      src: "/hero.jpg",
      width: 640,
      quality: 80,
      format: "webp",
      fit: "cover",
    });
  });

  it("rejects remote image sources", async () => {
    const response = parsed("/_rbssr/image?src=https%3A%2F%2Fexample.com%2Fx.jpg&w=640");
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(400);
    expect(await (response as Response).text()).toContain("local public path");
  });

  it("rejects invalid width and quality values", () => {
    expect(parsed("/_rbssr/image?src=%2Fhero.jpg&w=0")).toBeInstanceOf(Response);
    const response = parsed("/_rbssr/image?src=%2Fhero.jpg&w=640&q=101");
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(400);
  });

  it("rejects unsupported format and fit values", () => {
    expect(parsed("/_rbssr/image?src=%2Fhero.jpg&w=640&format=gif")).toBeInstanceOf(Response);
    expect(parsed("/_rbssr/image?src=%2Fhero.jpg&w=640&fit=stretch")).toBeInstanceOf(Response);
  });
});
