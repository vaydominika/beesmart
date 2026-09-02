import { describe, expect, it, vi } from "vitest";
import { defaultExtensions } from "./extensions";

vi.mock("novel", () => ({
  Command: { configure: () => ({ name: "slashCommand" }) },
  createSuggestionItems: (items: unknown[]) => items,
  renderItems: () => undefined,
  UpdatedImage: { name: "image" },
}));

describe("defaultExtensions", () => {
  it("registers each Tiptap extension name only once", () => {
    const names = defaultExtensions.map((extension) => extension.name);

    expect(names).toEqual([...new Set(names)]);
    expect(names.filter((name) => name === "image")).toHaveLength(1);
  });
});
