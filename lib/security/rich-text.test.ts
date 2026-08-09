import { describe, expect, it } from "vitest";
import { richTextToPlainText, sanitizeRichTextHtml } from "./rich-text";

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
