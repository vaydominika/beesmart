import { describe, expect, it } from "vitest";
import { normalizeGeneratedRichText, richTextToPlainText, sanitizeRichTextHtml } from "./rich-text";

describe("sanitizeRichTextHtml", () => {
  it("removes active content, handlers, unsafe URLs, and unsafe CSS", () => {
    const result = sanitizeRichTextHtml('<script>alert(1)</script><p onclick="x()">Hi<img src="javascript:alert(1)" onerror="x()"><span style="color:red;position:fixed">there</span></p>');
    expect(result).toBe('<p>Hi<img /><span style="color:red">there</span></p>');
  });

  it("preserves supported TipTap markup and hardens external tabs", () => {
    const result = sanitizeRichTextHtml('<h2>Title</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p><strong>Done</strong></p></li></ul><a href="https://example.com" target="_blank">link</a>');
    expect(result).toContain('data-type="taskList"');
    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).toContain('<strong>Done</strong>');
  });

  it("rejects data images and reports formatting-only content as empty", () => {
    expect(sanitizeRichTextHtml('<img src="data:image/png;base64,abc">')).toBe("<img />");
    expect(richTextToPlainText("<p><br></p>")).toBe("");
  });
});

describe("normalizeGeneratedRichText", () => {
  it("converts Markdown into sanitized TipTap-compatible HTML", () => {
    expect(normalizeGeneratedRichText("## Cell structure\n\nCells have **membranes**.\n\n- Nucleus\n- Cytoplasm"))
      .toBe("<h2>Cell structure</h2>\n<p>Cells have <strong>membranes</strong>.</p>\n<ul>\n<li>Nucleus</li>\n<li>Cytoplasm</li>\n</ul>");
  });

  it("preserves semantic HTML and removes unsafe generated markup", () => {
    expect(normalizeGeneratedRichText("```html\n<h2>Cells</h2><script>alert(1)</script><p onclick=\"bad()\">Safe text</p>\n```"))
      .toBe("<h2>Cells</h2><p>Safe text</p>");
  });
});
