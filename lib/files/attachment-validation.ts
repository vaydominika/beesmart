type AttachmentValues = {
  nestedDestination?: "course" | "post" | "submission" | "report";
  hasStoredFile?: boolean;
  courseId?: string | null;
  lessonId?: string | null;
  postId?: string | null;
  submissionId?: string | null;
  reportId?: string | null;
  storedFileId?: string | null;
  legacyFileName?: string | null;
  legacyFileUrl?: string | null;
  legacyFileType?: string | null;
  legacyFileSize?: number | null;
  isVisible?: boolean;
};

type CourseLessonReader = {
  courseLesson: {
    findFirst(args: {
      where: { id: string; module: { courseId: string } };
      select: { id: true };
    }): Promise<unknown>;
  };
};

export class AttachmentValidationError extends Error {}

export async function validateAttachment(
  db: CourseLessonReader,
  values: AttachmentValues,
): Promise<void> {
  const destinationCount = Number(Boolean(
    values.courseId || values.lessonId || values.nestedDestination === "course",
  ))
    + Number(Boolean(values.postId || values.nestedDestination === "post"))
    + Number(Boolean(values.submissionId || values.nestedDestination === "submission"))
    + Number(Boolean(values.reportId || values.nestedDestination === "report"));

  if (destinationCount !== 1) {
    throw new AttachmentValidationError("Attachment requires exactly one destination");
  }

  if (values.courseId && values.lessonId) {
    const lesson = await db.courseLesson.findFirst({
      where: { id: values.lessonId, module: { courseId: values.courseId } },
      select: { id: true },
    });
    if (!lesson) {
      throw new AttachmentValidationError("Attachment course must match its lesson");
    }
  }

  const legacyMetadata = [
    values.legacyFileName,
    values.legacyFileUrl,
    values.legacyFileType,
    values.legacyFileSize,
  ];

  const hasStoredFile = Boolean(values.storedFileId || values.hasStoredFile);
  if (hasStoredFile && legacyMetadata.some((value) => value != null)) {
    throw new AttachmentValidationError("Managed attachment metadata belongs on StoredFile");
  }

  if (!hasStoredFile) {
    if (values.reportId || values.nestedDestination === "report") {
      throw new AttachmentValidationError("Report attachments require a stored file");
    }
    if (values.legacyFileName == null || values.legacyFileType == null || values.legacyFileSize == null) {
      throw new AttachmentValidationError("Attachment requires stored file or legacy metadata");
    }
  }
}

export async function validateAttachmentUpdate(
  db: CourseLessonReader,
  current: AttachmentValues,
  changes: AttachmentValues,
): Promise<void> {
  const definedChanges = Object.fromEntries(
    Object.entries(changes).filter(([, value]) => value !== undefined),
  ) as AttachmentValues;
  await validateAttachment(db, { ...current, ...definedChanges });
}
