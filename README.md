# tiny-myers

Zero-dependency Myers `O((N + M)D)` diff algorithm and unified patch generator in TypeScript.

## Usage

```ts
import { createPatch, diff, diffLines } from "tiny-myers";

// Generic array diff
const edits = diff(["a", "b", "c"], ["a", "x", "c"]);
// [
//   { op: "equal", item: "a", oldIndex: 0, newIndex: 0 },
//   { op: "delete", item: "b", oldIndex: 1, newIndex: 1 },
//   { op: "insert", item: "x", oldIndex: 2, newIndex: 1 },
//   { op: "equal", item: "c", oldIndex: 2, newIndex: 2 },
// ]

// Line diff
const lineEdits = diffLines("hello\nworld\n", "hello\nthere\n");

// Git-style unified patch
const patch = createPatch("greeting.txt", "hello\nworld\n", "hello\nthere\n");
console.log(patch);
// --- a/greeting.txt
// +++ b/greeting.txt
// @@ -1,2 +1,2 @@
//  hello
// -world
// +there
```

## API

### `diff<T>(oldItems: readonly T[], newItems: readonly T[], equals?: (a: T, b: T) => boolean): DiffEdit<T>[]`

Computes the shortest edit script between two arrays using Eugene Myers' `O((N + M)D)` algorithm.

### `diffLines(oldText: string, newText: string): DiffEdit<string>[]`

Splits both strings on `\r?\n` and returns the line-by-line edit script.

### `createPatch(fileName: string, oldText: string, newText: string, options?: PatchOptions): string`

Generates a unified diff patch string (`""` if texts are identical).

- `context`: Number of unchanged context lines around each hunk (default `3`).
- `oldHeader` / `newHeader`: Custom header labels (default `"a/<fileName>"` and `"b/<fileName>"`).

## License

MIT
