import { describe, expect, it } from "vitest";
import { assignmentDescriptionPostContent } from "./classroom-post-drafts";

describe("assignmentDescriptionPostContent", () => {
    it("moves a multiline assignment description into rich-text post paragraphs", () => {
        expect(assignmentDescriptionPostContent("Read chapter 5.\nAnswer every question."))
            .toBe("<p>Read chapter 5.</p><p>Answer every question.</p>");
    });

    it("escapes markup and preserves blank lines", () => {
        expect(assignmentDescriptionPostContent("Use <section> & notes\n\nDone"))
            .toBe("<p>Use &lt;section&gt; &amp; notes</p><p><br></p><p>Done</p>");
    });

    it("leaves the post input unchanged when the assignment has no description", () => {
        expect(assignmentDescriptionPostContent(null)).toBe("");
    });
});
