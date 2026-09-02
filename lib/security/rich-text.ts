import sanitizeHtml from "sanitize-html";
import MarkdownIt from "markdown-it";

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
});

const ALLOWED_TAGS = [
  "p", "br", "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "strike",
  "ul", "ol", "li", "blockquote", "pre", "code", "hr",
  "a", "img", "span", "mark",
];

const COLOR = /^(?:#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)|[a-z]{1,20})$/i;

export function sanitizeRichTextHtml(value: unknown): string {
  if (typeof value !== "string" || !value) return "";

  return sanitizeHtml(value, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      ul: ["data-type"],
      ol: ["data-type", "start"],
      li: ["data-type", "data-checked"],
      span: ["style"],
      mark: ["style", "data-color"],
      p: ["style"],
      h1: ["style"], h2: ["style"], h3: ["style"],
      h4: ["style"], h5: ["style"], h6: ["style"],
    },
    allowedStyles: {
      span: { color: [COLOR], "background-color": [COLOR] },
      mark: { color: [COLOR], "background-color": [COLOR] },
      p: { "text-align": [/^(?:left|right|center|justify)$/] },
      h1: { "text-align": [/^(?:left|right|center|justify)$/] },
      h2: { "text-align": [/^(?:left|right|center|justify)$/] },
      h3: { "text-align": [/^(?:left|right|center|justify)$/] },
      h4: { "text-align": [/^(?:left|right|center|justify)$/] },
      h5: { "text-align": [/^(?:left|right|center|justify)$/] },
      h6: { "text-align": [/^(?:left|right|center|justify)$/] },
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    enforceHtmlBoundary: true,
    transformTags: {
      a: (_tagName, attribs) => {
        const target = attribs.target === "_blank" ? "_blank" : undefined;
        return {
          tagName: "a",
          attribs: {
            ...attribs,
            ...(target ? { target, rel: "noopener noreferrer" } : {}),
          },
        };
      },
    },
  }).trim();
}

export function normalizeGeneratedRichText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";

  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:html|markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  const unwrapped = fenced?.[1] ?? trimmed;

  return sanitizeRichTextHtml(markdown.render(unwrapped));
}

export function richTextToPlainText(value: unknown): string {
  const safe = sanitizeRichTextHtml(value);
  return sanitizeHtml(safe, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&(?:amp|lt|gt|quot|#39);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
