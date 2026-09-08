import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SvgXml } from "react-native-svg";
import { expect, it, vi } from "vitest";
import { getProviderIcon } from "./provider-icons";

vi.mock("react-native-svg", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-native-svg")>()),
  SvgXml: vi.fn(() => null),
}));

it.each(["#f5f5f5", "#171717"])(
  "passes theme color %s through the Hermes provider icon",
  (color) => {
    vi.mocked(SvgXml).mockClear();
    const Icon = getProviderIcon("hermes");
    renderToStaticMarkup(createElement(Icon, { size: 24, color }));

    expect(SvgXml).toHaveBeenCalledOnce();
    const { xml, ...props } = vi.mocked(SvgXml).mock.calls[0][0];
    expect(props).toMatchObject({ color, width: 24, height: 24 });
    expect(typeof xml).toBe("string");
    if (typeof xml !== "string") throw new Error("Hermes must supply SVG markup");
    expect(xml).toMatch(/<svg[^>]*fill="currentColor"/);
    const fills = [...xml.matchAll(/fill="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(fills)).toEqual(new Set(["currentColor"]));
    expect(xml.match(/<path\b/g)).toHaveLength(3);
  },
);
