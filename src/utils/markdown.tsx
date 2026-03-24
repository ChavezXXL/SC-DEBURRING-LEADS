import React from 'react';

/**
 * Simple markdown renderer for lead notes.
 * Handles: headers, bold, italic, links, bullet lists, line breaks.
 */
export function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listKey = 0;

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${listKey++}`} className="ml-4 list-disc space-y-0.5 text-zinc-400">
          {listItems}
        </ul>
      );
      listItems = [];
    }
  }

  function formatInline(line: string): React.ReactNode {
    // Process bold, italic, links, code
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    while (remaining.length > 0) {
      // Links: [text](url)
      const linkMatch = remaining.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
      // Bold: **text** or __text__
      const boldMatch = remaining.match(/\*\*(.+?)\*\*|__(.+?)__/);
      // Italic: *text* or _text_
      const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/);
      // Inline code: `text`
      const codeMatch = remaining.match(/`([^`]+)`/);

      // Find earliest match
      const matches = [
        linkMatch ? { type: 'link', match: linkMatch } : null,
        boldMatch ? { type: 'bold', match: boldMatch } : null,
        italicMatch ? { type: 'italic', match: italicMatch } : null,
        codeMatch ? { type: 'code', match: codeMatch } : null,
      ].filter(Boolean).sort((a, b) => (a!.match.index || 0) - (b!.match.index || 0));

      if (matches.length === 0) {
        parts.push(remaining);
        break;
      }

      const first = matches[0]!;
      const idx = first.match.index || 0;

      if (idx > 0) {
        parts.push(remaining.substring(0, idx));
      }

      if (first.type === 'link') {
        const m = first.match;
        parts.push(
          <a key={key++} href={m[2]} target="_blank" rel="noreferrer" className="text-orange-400 underline hover:text-orange-300">
            {m[1]}
          </a>
        );
      } else if (first.type === 'bold') {
        const m = first.match;
        parts.push(<strong key={key++} className="font-semibold text-zinc-200">{m[1] || m[2]}</strong>);
      } else if (first.type === 'italic') {
        const m = first.match;
        parts.push(<em key={key++} className="italic text-zinc-400">{m[1] || m[2]}</em>);
      } else if (first.type === 'code') {
        const m = first.match;
        parts.push(<code key={key++} className="rounded bg-zinc-800 px-1 py-0.5 text-orange-300">{m[1]}</code>);
      }

      remaining = remaining.substring(idx + first.match[0].length);
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers
    if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h4 key={i} className="mt-3 mb-1 text-xs font-bold text-orange-400 uppercase tracking-wide">
          {formatInline(line.slice(4))}
        </h4>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h3 key={i} className="mt-3 mb-1 text-sm font-bold text-orange-500">
          {formatInline(line.slice(3))}
        </h3>
      );
      continue;
    }
    if (line.startsWith('# ')) {
      flushList();
      elements.push(
        <h2 key={i} className="mt-3 mb-1 text-sm font-bold text-orange-500">
          {formatInline(line.slice(2))}
        </h2>
      );
      continue;
    }

    // Bullet lists: *, -, or indented *
    const bulletMatch = line.match(/^\s*[\*\-]\s+(.+)/);
    if (bulletMatch) {
      const indent = line.match(/^(\s*)/)?.[1]?.length || 0;
      listItems.push(
        <li key={i} className={indent > 2 ? 'ml-4 text-zinc-500' : ''}>
          {formatInline(bulletMatch[1])}
        </li>
      );
      continue;
    }

    // Timestamp lines like [3/18/2026 — Contact Research]
    const stampMatch = line.match(/^\[(\d+\/\d+\/\d+)\s*[—\-]\s*(.+)\]$/);
    if (stampMatch) {
      flushList();
      elements.push(
        <div key={i} className="mt-3 mb-1 flex items-center gap-2 rounded-md bg-zinc-800/50 px-2 py-1 text-[10px] font-mono text-zinc-500">
          <span className="text-orange-500/70">{stampMatch[1]}</span>
          <span>·</span>
          <span>{stampMatch[2]}</span>
        </div>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      flushList();
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={i} className="text-zinc-400 leading-relaxed">
        {formatInline(line)}
      </p>
    );
  }

  flushList();
  return <div className="space-y-1">{elements}</div>;
}
