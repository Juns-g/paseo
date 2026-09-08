import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, expect, it } from "vitest";
import { getProviderIcon } from "./provider-icons";

const container = document.createElement("div");
document.body.appendChild(container);
const root = createRoot(container);

afterEach(() => {
  flushSync(() => root.render(null));
});

afterAll(() => {
  flushSync(() => root.unmount());
  container.remove();
});

it.each([
  ["#f5f5f5", "rgb(245, 245, 245)"],
  ["#171717", "rgb(23, 23, 23)"],
])("renders Hermes paths in theme color %s", (color, expectedFill) => {
  const Icon = getProviderIcon("hermes");
  flushSync(() => root.render(<Icon size={24} color={color} />));

  const paths = [...container.querySelectorAll("svg path")];
  expect(paths).toHaveLength(3);
  expect(paths.map((path) => getComputedStyle(path).fill)).toEqual([
    expectedFill,
    expectedFill,
    expectedFill,
  ]);
  expect(container.querySelector("svg")?.getBoundingClientRect().width).toBe(24);
});
