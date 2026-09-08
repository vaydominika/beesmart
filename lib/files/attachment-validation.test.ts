import { describe, expect, it, vi } from "vitest";
import {
  AttachmentValidationError,
  validateAttachment,
  validateAttachmentUpdate,
} from "./attachment-validation";

const db = (lessonExists = true) => ({
  courseLesson: {
    findFirst: vi.fn().mockResolvedValue(lessonExists ? { id: "lesson-1" } : null),
  },
});

describe("attachment validation", () => {
  it("requires exactly one destination", async () => {
    await expect(validateAttachment(db(), {
      courseId: "course-1",
      postId: "post-1",
      storedFileId: "file-1",
    })).rejects.toThrow("exactly one destination");

    await expect(validateAttachment(db(), {
      storedFileId: "file-1",
    })).rejects.toBeInstanceOf(AttachmentValidationError);
  });

  it("treats a course and one of its lessons as one destination", async () => {
    const reader = db();
    await validateAttachment(reader, {
      courseId: "course-1",
      lessonId: "lesson-1",
      storedFileId: "file-1",
    });
    expect(reader.courseLesson.findFirst).toHaveBeenCalledWith({
      where: { id: "lesson-1", module: { courseId: "course-1" } },
      select: { id: true },
    });
  });

  it("rejects a lesson that does not belong to the course", async () => {
    await expect(validateAttachment(db(false), {
      courseId: "course-1",
      lessonId: "lesson-1",
      storedFileId: "file-1",
    })).rejects.toThrow("course must match its lesson");
  });

  it("keeps managed and legacy metadata mutually exclusive", async () => {
    await expect(validateAttachment(db(), {
      postId: "post-1",
      storedFileId: "file-1",
      legacyFileName: "legacy.pdf",
    })).rejects.toThrow("metadata belongs on StoredFile");
  });

  it("requires legacy metadata when there is no stored file", async () => {
    await expect(validateAttachment(db(), {
      submissionId: "submission-1",
      legacyFileName: "legacy.pdf",
      legacyFileType: "PDF",
    })).rejects.toThrow("stored file or legacy metadata");

    await validateAttachment(db(), {
      submissionId: "submission-1",
      legacyFileName: "legacy.pdf",
      legacyFileUrl: "/uploads/legacy.pdf",
      legacyFileType: "PDF",
      legacyFileSize: 42,
    });
  });

  it("requires report attachments to use stored files", async () => {
    await expect(validateAttachment(db(), {
      reportId: "report-1",
      legacyFileName: "legacy.png",
      legacyFileType: "IMAGE",
      legacyFileSize: 42,
    })).rejects.toThrow("Report attachments require a stored file");

    await validateAttachment(db(), {
      nestedDestination: "report",
      storedFileId: "file-1",
    });
  });

  it("validates the complete attachment state on updates", async () => {
    const current = { courseId: "course-1", storedFileId: "file-1" };
    await expect(validateAttachmentUpdate(db(), current, {
      courseId: null,
    })).rejects.toThrow("exactly one destination");
    await expect(validateAttachmentUpdate(db(), current, {
      legacyFileName: "duplicate.pdf",
    })).rejects.toThrow("metadata belongs on StoredFile");
    await validateAttachmentUpdate(db(), current, { isVisible: false });
    await validateAttachmentUpdate(db(), current, { courseId: undefined });
  });
});
