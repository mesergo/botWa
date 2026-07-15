import React from 'react';

/**
 * WhatsApp native formatting renderer.
 * Supports: *bold*, _italic_, ~~strikethrough~~, `inline code`, ```monospace block```,
 * > quote, - bullet list, 1. numbered list, and URL linkification.
 */

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function linkifyText(text: string): React.ReactNode[] {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) =>
    URL_REGEX.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-sky-600 hover:text-sky-800 break-all"
        onClick={e => e.stopPropagation()}
      >
        {part}
      </a>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

/**
 * Apply inline formatting to a string segment.
 * Order: ```mono``` > `code` > *bold* > _italic_ > ~~strike~~
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode {
  if (!text) return null;

  // Each matcher: regex (non-global, fresh each call), and a renderer
  const matchers: Array<{
    re: RegExp;
    noRecurse?: boolean;
    render: (inner: React.ReactNode, raw: string) => React.ReactNode;
  }> = [
    {
      re: /```([\s\S]+?)```/,
      noRecurse: true,
      render: (_: React.ReactNode, raw: string) => (
        <code style={{ fontFamily: 'monospace', background: '#f1f5f9', borderRadius: '3px', padding: '1px 5px', fontSize: '0.9em', color: '#1e293b' }}>{raw}</code>
      ),
    },
    {
      re: /`([^`\n]+)`/,
      noRecurse: true,
      render: (_: React.ReactNode, raw: string) => (
        <code style={{ fontFamily: 'monospace', background: '#f1f5f9', borderRadius: '3px', padding: '1px 5px', fontSize: '0.9em', color: '#1e293b' }}>{raw}</code>
      ),
    },
    {
      re: /\*([^*\n]+)\*/,
      render: (inner: React.ReactNode) => <strong style={{ fontWeight: 700 }}>{inner}</strong>,
    },
    {
      re: /~~([^\n]+?)~~/,
      render: (inner: React.ReactNode) => <s style={{ textDecoration: 'line-through' }}>{inner}</s>,
    },
    {
      re: /_([^_\n]+)_/,
      render: (inner: React.ReactNode) => <em style={{ fontStyle: 'italic' }}>{inner}</em>,
    },
  ];

  // Find earliest match among all patterns
  let bestIdx = text.length;
  let bestMatch: RegExpExecArray | null = null;
  let bestMatcher: (typeof matchers)[0] | null = null;

  for (const matcher of matchers) {
    const m = new RegExp(matcher.re.source).exec(text);
    if (m && m.index < bestIdx) {
      bestIdx = m.index;
      bestMatch = m;
      bestMatcher = matcher;
    }
  }

  if (!bestMatch || !bestMatcher) {
    return <>{linkifyText(text)}</>;
  }

  const before = text.slice(0, bestMatch.index);
  const content = bestMatch[1];
  const after = text.slice(bestMatch.index + bestMatch[0].length);

  const innerNode = bestMatcher.noRecurse
    ? content
    : renderInline(content, `${keyPrefix}i`);

  return (
    <>
      {before ? linkifyText(before) : null}
      {bestMatcher.render(innerNode, content)}
      {after ? renderInline(after, `${keyPrefix}a`) : null}
    </>
  );
}

type LineBlock =
  | { type: 'text'; content: string }
  | { type: 'quote'; content: string }
  | { type: 'bullet'; items: string[] }
  | { type: 'ordered'; items: string[] }
  | { type: 'mono'; content: string };

function parseBlocks(text: string): LineBlock[] {
  const lines = text.split('\n');
  const blocks: LineBlock[] = [];

  // Collect multi-line ```...``` blocks first
  const monoBlockRe = /^```$/;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Multi-line monospace block: lines between ``` fences
    if (monoBlockRe.test(line.trim())) {
      const monoLines: string[] = [];
      i++;
      while (i < lines.length && !monoBlockRe.test(lines[i].trim())) {
        monoLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: 'mono', content: monoLines.join('\n') });
      continue;
    }

    // Inline-fenced mono on a single line: ```text```
    const inlineMonoMatch = line.match(/^```(.+)```$/);
    if (inlineMonoMatch) {
      blocks.push({ type: 'mono', content: inlineMonoMatch[1] });
      i++;
      continue;
    }

    // Quote: "> text"
    if (/^> /.test(line)) {
      blocks.push({ type: 'quote', content: line.slice(2) });
      i++;
      continue;
    }

    // Bullet: "- text" only (not "* text" — that conflicts with *bold* markers)
    if (/^- /.test(line)) {
      const items: string[] = [line.slice(2)];
      i++;
      while (i < lines.length && /^- /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: 'bullet', items });
      continue;
    }

    // Ordered list: "1. text"
    if (/^\d+\. /.test(line)) {
      const items: string[] = [line.replace(/^\d+\. /, '')];
      i++;
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''));
        i++;
      }
      blocks.push({ type: 'ordered', items });
      continue;
    }

    blocks.push({ type: 'text', content: line });
    i++;
  }

  return blocks;
}

export const WhatsAppText = ({ text, className = '' }: { text: string; className?: string }) => {
  if (!text) return null;
  // Strip zero-width spaces that the WYSIWYG editor may insert
  const cleanText = text.replace(/\u200B/g, '');
  const blocks = parseBlocks(cleanText);

  return (
    <span className={`whitespace-pre-wrap break-words ${className}`} dir="auto">
      {blocks.map((block, bi) => {
        switch (block.type) {
          case 'mono':
            return (
              <code
                key={bi}
                className="block font-mono bg-slate-100 text-slate-800 rounded-lg px-3 py-2 text-[0.88em] my-0.5 whitespace-pre-wrap"
              >
                {block.content}
              </code>
            );
          case 'quote':
            return (
              <span
                key={bi}
                className="block border-r-4 border-slate-400 pr-3 text-slate-600 italic my-0.5"
                dir="rtl"
              >
                {renderInline(block.content, `q${bi}`)}
              </span>
            );
          case 'bullet':
            return (
              <ul key={bi} className="list-disc my-0.5 space-y-0.5 pr-5" dir="rtl">
                {block.items.map((item, ii) => (
                  <li key={ii}>{renderInline(item, `b${bi}-${ii}`)}</li>
                ))}
              </ul>
            );
          case 'ordered':
            return (
              <ol key={bi} className="list-decimal my-0.5 space-y-0.5 pr-5" dir="rtl">
                {block.items.map((item, ii) => (
                  <li key={ii}>{renderInline(item, `o${bi}-${ii}`)}</li>
                ))}
              </ol>
            );
          default:
            return (
              <React.Fragment key={bi}>
                {bi > 0 && '\n'}
                {renderInline(block.content, `t${bi}`)}
              </React.Fragment>
            );
        }
      })}
    </span>
  );
};
