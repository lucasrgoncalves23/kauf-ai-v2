"use client";

import { useCallback, useState } from "react";

// Only action ids are stored (e.g. "sono:1"); never any health data.
function load(key: string | null): Set<string> {
  if (!key || typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function useChecklist(storageKey: string | null) {
  const [checked, setChecked] = useState<Set<string>>(() => load(storageKey));

  const toggle = useCallback(
    (id: string) => {
      setChecked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        if (storageKey) {
          try {
            window.localStorage.setItem(storageKey, JSON.stringify([...next]));
          } catch {
            /* storage unavailable (private mode); keep in memory */
          }
        }
        return next;
      });
    },
    [storageKey]
  );

  return { isChecked: (id: string) => checked.has(id), toggle };
}
