export type DiffOp = "equal" | "delete" | "insert";

export interface DiffEdit<T> {
  op: DiffOp;
  item: T;
  oldIndex: number;
  newIndex: number;
}

export interface PatchOptions {
  oldHeader?: string;
  newHeader?: string;
  context?: number;
}

const defaultEquals = <T>(a: T, b: T): boolean => a === b;

export function diff<T>(
  oldItems: readonly T[],
  newItems: readonly T[],
  equals: (a: T, b: T) => boolean = defaultEquals,
): DiffEdit<T>[] {
  const oldLen = oldItems.length;
  const newLen = newItems.length;

  let start = 0;
  while (start < oldLen && start < newLen && equals(oldItems[start]!, newItems[start]!)) {
    start++;
  }

  let oldEnd = oldLen;
  let newEnd = newLen;
  while (oldEnd > start && newEnd > start && equals(oldItems[oldEnd - 1]!, newItems[newEnd - 1]!)) {
    oldEnd--;
    newEnd--;
  }

  const edits: DiffEdit<T>[] = [];

  for (let i = 0; i < start; i++) {
    edits.push({
      op: "equal",
      item: oldItems[i]!,
      oldIndex: i,
      newIndex: i,
    });
  }

  const n = oldEnd - start;
  const m = newEnd - start;

  if (n === 0 && m > 0) {
    for (let j = 0; j < m; j++) {
      edits.push({
        op: "insert",
        item: newItems[start + j]!,
        oldIndex: start,
        newIndex: start + j,
      });
    }
  } else if (m === 0 && n > 0) {
    for (let i = 0; i < n; i++) {
      edits.push({
        op: "delete",
        item: oldItems[start + i]!,
        oldIndex: start + i,
        newIndex: start,
      });
    }
  } else if (n > 0 && m > 0) {
    const max = n + m;
    const offset = max;
    const v = new Int32Array(2 * max + 1);
    const trace: Int32Array[] = [];

    outer: for (let d = 0; d <= max; d++) {
      for (let k = -d; k <= d; k += 2) {
        let x: number;
        if (k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!)) {
          x = v[offset + k + 1]!;
        } else {
          x = v[offset + k - 1]! + 1;
        }

        let y = x - k;
        while (x < n && y < m && equals(oldItems[start + x]!, newItems[start + y]!)) {
          x++;
          y++;
        }

        v[offset + k] = x;
        if (x >= n && y >= m) {
          trace.push(v.slice());
          break outer;
        }
      }
      trace.push(v.slice());
    }

    const midEdits: DiffEdit<T>[] = [];
    let x = n;
    let y = m;

    for (let d = trace.length - 1; d > 0; d--) {
      const vPrev = trace[d - 1]!;
      const k = x - y;
      const prevK =
        k === -d || (k !== d && vPrev[offset + k - 1]! < vPrev[offset + k + 1]!) ? k + 1 : k - 1;

      const xStart = vPrev[offset + prevK]!;
      const yStart = xStart - prevK;
      const xMid = prevK === k + 1 ? xStart : xStart + 1;
      const yMid = xMid - k;

      while (x > xMid && y > yMid) {
        x--;
        y--;
        midEdits.push({
          op: "equal",
          item: oldItems[start + x]!,
          oldIndex: start + x,
          newIndex: start + y,
        });
      }

      if (prevK === k + 1) {
        midEdits.push({
          op: "insert",
          item: newItems[start + yStart]!,
          oldIndex: start + xStart,
          newIndex: start + yStart,
        });
      } else {
        midEdits.push({
          op: "delete",
          item: oldItems[start + xStart]!,
          oldIndex: start + xStart,
          newIndex: start + yStart,
        });
      }

      x = xStart;
      y = yStart;
    }

    while (x > 0 && y > 0) {
      x--;
      y--;
      midEdits.push({
        op: "equal",
        item: oldItems[start + x]!,
        oldIndex: start + x,
        newIndex: start + y,
      });
    }

    for (let i = midEdits.length - 1; i >= 0; i--) {
      edits.push(midEdits[i]!);
    }
  }

  const suffixCount = oldLen - oldEnd;
  for (let i = 0; i < suffixCount; i++) {
    edits.push({
      op: "equal",
      item: oldItems[oldEnd + i]!,
      oldIndex: oldEnd + i,
      newIndex: newEnd + i,
    });
  }

  return edits;
}

function splitLines(text: string): string[] {
  if (text.length === 0) return [];
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

export function diffLines(oldText: string, newText: string): DiffEdit<string>[] {
  return diff(splitLines(oldText), splitLines(newText));
}

function formatRange(start: number, count: number): string {
  if (count === 0) return `${start},0`;
  if (count === 1) return `${start + 1}`;
  return `${start + 1},${count}`;
}

export function createPatch(
  fileName: string,
  oldText: string,
  newText: string,
  options: PatchOptions = {},
): string {
  const context = options.context ?? 3;
  const edits = diffLines(oldText, newText);

  const changeIndices: number[] = [];
  for (let i = 0; i < edits.length; i++) {
    if (edits[i]!.op !== "equal") {
      changeIndices.push(i);
    }
  }

  if (changeIndices.length === 0) {
    return "";
  }

  const groups: Array<[start: number, end: number]> = [];
  for (const idx of changeIndices) {
    const start = Math.max(0, idx - context);
    const end = Math.min(edits.length - 1, idx + context);
    const last = groups[groups.length - 1];
    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      groups.push([start, end]);
    }
  }

  const oldHeader = options.oldHeader ?? `a/${fileName}`;
  const newHeader = options.newHeader ?? `b/${fileName}`;
  const out: string[] = [`--- ${oldHeader}`, `+++ ${newHeader}`];

  for (const [start, end] of groups) {
    let oldCount = 0;
    let newCount = 0;
    const first = edits[start]!;
    const oldStart = first.oldIndex;
    const newStart = first.newIndex;
    const hunkLines: string[] = [];

    for (let i = start; i <= end; i++) {
      const edit = edits[i]!;
      if (edit.op === "equal") {
        oldCount++;
        newCount++;
        hunkLines.push(` ${edit.item}`);
      } else if (edit.op === "delete") {
        oldCount++;
        hunkLines.push(`-${edit.item}`);
      } else {
        newCount++;
        hunkLines.push(`+${edit.item}`);
      }
    }

    out.push(
      `@@ -${formatRange(oldStart, oldCount)} +${formatRange(newStart, newCount)} @@`,
      ...hunkLines,
    );
  }

  return `${out.join("\n")}\n`;
}
