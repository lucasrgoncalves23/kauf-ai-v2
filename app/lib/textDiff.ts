// Line-based diff for comparing consulta texts (conduta items are one per
// line, so line granularity is the clinically meaningful unit).

export type DiffLineType = "same" | "removed" | "added";

export type DiffLine = {
  text: string;
  type: DiffLineType;
};

export type LineDiff = {
  /** Lines of the older text; removed lines marked. */
  left: DiffLine[];
  /** Lines of the newer text; added lines marked. */
  right: DiffLine[];
};

// Above this, LCS cost isn't worth it — render without highlighting
const MAX_LCS_CELLS = 250_000;

/**
 * Diff two texts line-by-line via LCS. Whitespace-trimmed lines are compared;
 * blank lines are kept for layout but never marked.
 */
export function diffLines(oldText: string, newText: string): LineDiff {
  const a = (oldText || "").split("\n");
  const b = (newText || "").split("\n");

  if (a.length * b.length > MAX_LCS_CELLS) {
    return {
      left: a.map((text) => ({ text, type: "same" as const })),
      right: b.map((text) => ({ text, type: "same" as const })),
    };
  }

  const aKey = a.map((l) => l.trim());
  const bKey = b.map((l) => l.trim());

  // LCS length table
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        aKey[i] === bKey[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const left: DiffLine[] = [];
  const right: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (aKey[i] === bKey[j]) {
      left.push({ text: a[i], type: "same" });
      right.push({ text: b[j], type: "same" });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      left.push({ text: a[i], type: aKey[i] ? "removed" : "same" });
      i++;
    } else {
      right.push({ text: b[j], type: bKey[j] ? "added" : "same" });
      j++;
    }
  }
  while (i < m) {
    left.push({ text: a[i], type: aKey[i] ? "removed" : "same" });
    i++;
  }
  while (j < n) {
    right.push({ text: b[j], type: bKey[j] ? "added" : "same" });
    j++;
  }

  return { left, right };
}

/** Count meaningful changes for a section summary badge. */
export function diffStats(diff: LineDiff): { added: number; removed: number } {
  return {
    added: diff.right.filter((l) => l.type === "added").length,
    removed: diff.left.filter((l) => l.type === "removed").length,
  };
}
