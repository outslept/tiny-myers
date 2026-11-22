import { describe, expect, it } from "vite-plus/test";
import { createPatch, diff, diffLines } from "./index.ts";

describe("tiny-myers", () => {
  it("computes minimal edit script for arrays", () => {
    const a = ["A", "B", "C", "A", "B", "B", "A"];
    const b = ["C", "B", "A", "B", "A", "C"];
    const edits = diff(a, b);

    const reconstructedOld = edits.filter((e) => e.op !== "insert").map((e) => e.item);
    const reconstructedNew = edits.filter((e) => e.op !== "delete").map((e) => e.item);

    expect(reconstructedOld).toEqual(a);
    expect(reconstructedNew).toEqual(b);

    const nonEqual = edits.filter((e) => e.op !== "equal");
    expect(nonEqual).toHaveLength(5);
  });

  it("handles empty inputs, identical inputs, and custom comparators", () => {
    expect(diff([], [])).toEqual([]);
    expect(diff([1, 2], [1, 2]).map((e) => e.op)).toEqual(["equal", "equal"]);
    expect(diff([], ["x"]).map((e) => e.op)).toEqual(["insert"]);
    expect(diff(["x"], []).map((e) => e.op)).toEqual(["delete"]);

    const usersA = [{ id: 1, name: "Alice" }];
    const usersB = [{ id: 1, name: "Alice Renamed" }];
    expect(diff(usersA, usersB, (x, y) => x.id === y.id)).toHaveLength(1);
    expect(diff(usersA, usersB, (x, y) => x.id === y.id)[0]!.op).toBe("equal");
  });

  it("diffs multi-line strings and orders deletions before insertions", () => {
    const edits = diffLines("alpha\nbeta\ngamma\n", "alpha\nBETA\ngamma\n");
    expect(edits.map((e) => [e.op, e.item])).toEqual([
      ["equal", "alpha"],
      ["delete", "beta"],
      ["insert", "BETA"],
      ["equal", "gamma"],
    ]);
  });

  it("generates unified diff patches with context grouping", () => {
    const oldText = "line1\nline2\nline3\nline4\n";
    const newText = "line1\nline2-mod\nline3\nline4\n";

    expect(createPatch("file.txt", oldText, oldText)).toBe("");

    const patch = createPatch("file.txt", oldText, newText, { context: 1 });
    expect(patch).toBe(
      [
        "--- a/file.txt",
        "+++ b/file.txt",
        "@@ -1,3 +1,3 @@",
        " line1",
        "-line2",
        "+line2-mod",
        " line3",
        "",
      ].join("\n"),
    );
  });
});
