import { describe, expect, it } from "vitest";
import {
  projectDisplayNameFromProjectId,
  projectIconPlaceholderLabelFromDisplayName,
} from "./project-display-name";

describe("projectDisplayNameFromProjectId", () => {
  it("shows owner and repo for GitHub remote ids", () => {
    expect(projectDisplayNameFromProjectId("remote:github.com/getpaseo/paseo")).toBe(
      "getpaseo/paseo",
    );
  });

  it("shows the trailing directory name for local projects", () => {
    expect(projectDisplayNameFromProjectId("/Users/me/dev/paseo")).toBe("paseo");
  });
});

describe("projectIconPlaceholderLabelFromDisplayName", () => {
  it("uses repo name instead of owner for GitHub-style display names", () => {
    expect(projectIconPlaceholderLabelFromDisplayName("getpaseo/paseo")).toBe("paseo");
  });

  it("returns the original display name when it has no path separator", () => {
    expect(projectIconPlaceholderLabelFromDisplayName("paseo")).toBe("paseo");
  });
});

it("skips leading punctuation in icon labels while preserving text and emoji", () => {
  expect(projectIconPlaceholderLabelFromDisplayName("[调研] 追溯paseo父会话")).toBe(
    "调研] 追溯paseo父会话",
  );
  expect(projectIconPlaceholderLabelFromDisplayName(" 【开发】修复")).toBe("开发】修复");
  expect(projectIconPlaceholderLabelFromDisplayName("... -- hello")).toBe("hello");
  expect(projectIconPlaceholderLabelFromDisplayName("🔍 调研")).toBe("🔍 调研");
  expect(projectIconPlaceholderLabelFromDisplayName("[] --")).toBe("");
});
