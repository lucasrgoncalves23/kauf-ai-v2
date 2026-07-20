/**
 * Simple Markdown Renderer
 *
 * Converts **bold** and *italic* markdown to styled React elements.
 * Used for rendering chat messages and output content.
 */

import React from "react";

/**
 * Render simple markdown (bold and italic) to React nodes
 */
export function renderSimpleMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Try to match **bold** first
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Then try *italic*
    const italicMatch = remaining.match(/\*(.+?)\*/);

    // Find the earliest match
    let match: RegExpMatchArray | null = null;
    let isBold = false;

    if (boldMatch && italicMatch) {
      if ((boldMatch.index ?? Infinity) <= (italicMatch.index ?? Infinity)) {
        match = boldMatch;
        isBold = true;
      } else {
        match = italicMatch;
      }
    } else if (boldMatch) {
      match = boldMatch;
      isBold = true;
    } else if (italicMatch) {
      match = italicMatch;
    }

    if (match && match.index !== undefined) {
      // Add text before the match
      if (match.index > 0) {
        parts.push(React.createElement("span", { key: key++ }, remaining.slice(0, match.index)));
      }
      // Add the formatted text
      if (isBold) {
        parts.push(React.createElement("strong", { key: key++, className: "font-bold" }, match[1]));
      } else {
        parts.push(React.createElement("em", { key: key++, className: "italic" }, match[1]));
      }
      remaining = remaining.slice(match.index + match[0].length);
    } else {
      // No more matches, add remaining text
      parts.push(React.createElement("span", { key: key++ }, remaining));
      break;
    }
  }

  return parts.length > 0 ? parts : text;
}

/**
 * Block-level renderer for chat replies: paragraphs, bullet lists (- • *),
 * numbered lists and ###-style headings, with inline bold/italic.
 * The container must NOT use whitespace-pre-wrap — line breaks are handled here.
 */
export function renderChatMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let key = 0;
  let list: { ordered: boolean; start: number; items: string[] } | null = null;

  const flushList = () => {
    if (!list) return;
    const { ordered, start, items } = list;
    blocks.push(
      React.createElement(
        ordered ? "ol" : "ul",
        {
          key: key++,
          start: ordered ? start : undefined,
          className: `${ordered ? "list-decimal" : "list-disc"} pl-4 space-y-1 my-1`,
        },
        items.map((item) => React.createElement("li", { key: key++ }, renderSimpleMarkdown(item)))
      )
    );
    list = null;
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-•*]\s+(.*)/);
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)/);
    const heading = line.match(/^\s*#{1,4}\s+(.*)/);

    if (bullet) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, start: 1, items: [] };
      }
      list.items.push(bullet[1]);
    } else if (numbered) {
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, start: parseInt(numbered[1], 10) || 1, items: [] };
      }
      list.items.push(numbered[2]);
    } else if (heading) {
      flushList();
      blocks.push(
        React.createElement(
          "p",
          { key: key++, className: "font-semibold mt-2 mb-1" },
          renderSimpleMarkdown(heading[1])
        )
      );
    } else if (line.trim() === "") {
      flushList();
      blocks.push(React.createElement("div", { key: key++, className: "h-2" }));
    } else {
      flushList();
      blocks.push(React.createElement("p", { key: key++ }, renderSimpleMarkdown(line)));
    }
  }
  flushList();
  return blocks;
}

/**
 * Render text with line breaks preserved and markdown formatting
 */
export function renderMarkdownWithLineBreaks(text: string): React.ReactNode {
  if (!text) return null;
  return text.split("\n").map((line, lineIdx) =>
    React.createElement(
      "span",
      { key: lineIdx },
      lineIdx > 0 && React.createElement("br"),
      renderSimpleMarkdown(line)
    )
  );
}
