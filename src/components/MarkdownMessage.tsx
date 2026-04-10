"use client";

import React from "react";

interface MarkdownMessageProps {
  content: string;
  isUser?: boolean;
}

export function MarkdownMessage({ content, isUser = false }: MarkdownMessageProps) {
  const parseMarkdown = (text: string): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    let currentIndex = 0;

    // Split by line breaks to handle different block types
    const lines = text.split("\n");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Headings
      if (line.startsWith("# ")) {
        nodes.push(
          <h2 key={`h2-${currentIndex}`} className="text-lg font-bold mt-3 mb-2 text-foreground">
            {parseInlineMarkdown(line.substring(2))}
          </h2>
        );
        i++;
        currentIndex++;
        continue;
      }

      if (line.startsWith("## ")) {
        nodes.push(
          <h3 key={`h3-${currentIndex}`} className="text-base font-semibold mt-2 mb-1 text-foreground">
            {parseInlineMarkdown(line.substring(3))}
          </h3>
        );
        i++;
        currentIndex++;
        continue;
      }

      // Horizontal rule
      if (line.startsWith("---") || line.startsWith("***")) {
        nodes.push(<hr key={`hr-${currentIndex}`} className="my-3 border-t border-border/40" />);
        i++;
        currentIndex++;
        continue;
      }

      // Blockquote
      if (line.startsWith("> ")) {
        nodes.push(
          <blockquote
            key={`blockquote-${currentIndex}`}
            className="border-l-4 border-primary/50 pl-3 py-1 my-2 italic text-foreground/80 bg-primary/5 rounded-r"
          >
            {parseInlineMarkdown(line.substring(2))}
          </blockquote>
        );
        i++;
        currentIndex++;
        continue;
      }

      // Lists
      if (line.trim().startsWith("- ")) {
        const listItems: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith("- ")) {
          listItems.push(lines[i].trim().substring(2));
          i++;
        }
        nodes.push(
          <ul key={`ul-${currentIndex}`} className="list-disc list-inside my-2 space-y-1 text-foreground">
            {listItems.map((item, idx) => (
              <li key={`li-${idx}`} className="text-sm">
                {parseInlineMarkdown(item)}
              </li>
            ))}
          </ul>
        );
        currentIndex++;
        continue;
      }

      // Numbered lists
      if (line.trim().match(/^\d+\.\s/)) {
        const listItems: string[] = [];
        while (i < lines.length && lines[i].trim().match(/^\d+\.\s/)) {
          listItems.push(lines[i].trim().replace(/^\d+\.\s/, ""));
          i++;
        }
        nodes.push(
          <ol key={`ol-${currentIndex}`} className="list-decimal list-inside my-2 space-y-1 text-foreground">
            {listItems.map((item, idx) => (
              <li key={`ol-li-${idx}`} className="text-sm">
                {parseInlineMarkdown(item)}
              </li>
            ))}
          </ol>
        );
        currentIndex++;
        continue;
      }

      // Empty line
      if (line.trim() === "") {
        i++;
        continue;
      }

      // Regular paragraph
      if (line.trim()) {
        nodes.push(
          <p key={`p-${currentIndex}`} className="text-sm text-foreground leading-relaxed my-2">
            {parseInlineMarkdown(line)}
          </p>
        );
      }

      i++;
      currentIndex++;
    }

    return nodes;
  };

  const parseInlineMarkdown = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    let i = 0;

    while (i < text.length) {
      // Bold **text**
      if (text.slice(i, i + 2) === "**") {
        const endIndex = text.indexOf("**", i + 2);
        if (endIndex !== -1) {
          const boldText = text.slice(i + 2, endIndex);
          parts.push(
            <strong key={`bold-${currentIndex++}`} className="font-bold text-foreground">
              {boldText}
            </strong>
          );
          i = endIndex + 2;
          continue;
        }
      }

      // Italic *text*
      if (text[i] === "*" && text[i + 1] !== "*") {
        const endIndex = text.indexOf("*", i + 1);
        if (endIndex !== -1) {
          const italicText = text.slice(i + 1, endIndex);
          parts.push(
            <em key={`italic-${currentIndex++}`} className="italic text-foreground">
              {italicText}
            </em>
          );
          i = endIndex + 1;
          continue;
        }
      }

      // Code `text`
      if (text[i] === "`") {
        const endIndex = text.indexOf("`", i + 1);
        if (endIndex !== -1) {
          const codeText = text.slice(i + 1, endIndex);
          parts.push(
            <code
              key={`code-${currentIndex++}`}
              className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground/80"
            >
              {codeText}
            </code>
          );
          i = endIndex + 1;
          continue;
        }
      }

      // Regular text
      let nextSpecial = text.length;
      const nextBold = text.indexOf("**", i);
      const nextItalic = text.indexOf("*", i + 1);
      const nextCode = text.indexOf("`", i);

      nextSpecial = Math.min(
        ...[nextBold, nextItalic, nextCode].filter((idx) => idx > i)
      );

      if (nextSpecial === Infinity) {
        nextSpecial = text.length;
      }

      if (nextSpecial > i) {
        parts.push(text.slice(i, nextSpecial));
        i = nextSpecial;
      } else {
        i++;
      }
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div
      className={`rounded-lg p-3 ${
        isUser
          ? "bg-primary/10 border border-primary/30 text-foreground"
          : "bg-muted/50 border border-border/60 text-foreground"
      }`}
    >
      <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-bold prose-headings:my-2">
        {parseMarkdown(content)}
      </div>
    </div>
  );
}
