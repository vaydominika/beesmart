# Kódpéldák az alkalmazás fejlesztésének bemutatásához

Az alábbi rövid kódrészletek a BeeSmart jelenlegi implementációjából származnak. A dolgozatban érdemes csak azokat szerepeltetni, amelyek egy fontos tervezési döntést vagy biztonsági megoldást szemléltetnek. A teljes függvények helyett a lényegi részleteket emeltem ki.

## 1. Biztonságos regisztráció és e-mail-ellenőrzés

**Javasolt hely:** az 1.1.1. alfejezet jelszóhash-elést és ellenőrző tokent bemutató bekezdése után.

**Javasolt felvezető szöveg:**

> A regisztráció során a jelszó bcrypt hash formájában kerül az adatbázisba, az e-mail-ellenőrzéshez pedig csak a véletlenszerűen generált token SHA-256 lenyomatát tárolom. A felhasználó és a hozzá tartozó ellenőrző token egyetlen adatbázis-tranzakcióban jön létre.

```ts
const hashedPassword = await bcrypt.hash(password, 12);
const verificationToken = createEmailVerificationToken();
const verificationTokenHash = hashEmailVerificationToken(verificationToken);

const userId = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: { name, email, password: hashedPassword },
    select: { id: true },
  });

  await tx.verificationToken.create({
    data: {
      identifier: emailVerificationIdentifier(user.id),
      token: verificationTokenHash,
      expires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    },
  });

  return user.id;
});
```

Forrás: [`app/api/auth/register/route.ts`](../app/api/auth/register/route.ts)

## 2. Központosított kurzus-hozzáférés

**Javasolt hely:** az 1.1.1. alfejezet erőforrás-alapú jogosultságkezelést bemutató része után.

**Javasolt felvezető szöveg:**

> A kurzusok hozzáférési szabályait közös lekérdezési feltétel foglalja össze. Ez ugyanazon a helyen kezeli a tulajdonosi, nyilvános, meghívásos és tantermi hozzáférést, így az API-végpontoknak nem kell ezeket a szabályokat egymástól eltérően megismételniük.

```ts
export function accessibleCourseWhere(userId: string) {
  return {
    OR: [
      { createdById: userId },
      { visibility: "PUBLIC" as const, published: true },
      {
        visibility: "INVITATION_ONLY" as const,
        accessGrants: { some: { userId } },
      },
      classroomCourseAccessWhere(userId),
    ],
  };
}

export async function canAccessCourse(courseId: string, userId: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, ...accessibleCourseWhere(userId) },
    select: { id: true },
  });
  return Boolean(course);
}
```

Forrás: [`lib/course-access.ts`](../lib/course-access.ts)

## 3. Optimista átrendezés visszaállítással

**Javasolt hely:** az 1.1.3. alfejezet modulok drag-and-drop átrendezését ismertető bekezdése után.

**Javasolt felvezető szöveg:**

> A kurzusszerkesztő az átrendezés eredményét azonnal megjeleníti, majd a háttérben menti a szerverre. Sikertelen mentés esetén visszaállítja a korábbi sorrendet, és hibaüzenetet jelenít meg.

```tsx
const previousModules = course.modules;
const nextModules = reorderModules(
  course.modules,
  result.source.index,
  result.destination.index,
);

onCourseChange({ modules: nextModules });

try {
  const response = await fetch(`/api/courses/${course.id}/modules/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      list: nextModules.map((module) => ({ id: module.id, order: module.order })),
    }),
  });
  if (!response.ok) throw new Error();
} catch {
  onCourseChange({ modules: previousModules });
  toast.error("Module order could not be saved.");
}
```

Forrás: [`components/course/CourseBuilderSidebar.tsx`](../components/course/CourseBuilderSidebar.tsx)

## 4. Feladat és védett naptári esemény közös tranzakcióban

**Javasolt hely:** az 1.1.5. alfejezet automatikusan létrehozott naptári eseményt bemutató bekezdése után.

**Javasolt felvezető szöveg:**

> A feladat és a határidőt megjelenítő naptári esemény azonos Prisma-tranzakcióban jön létre. Az eseményt védettként jelölöm, mert annak időpontját nem a naptárban, hanem a feladat módosításával kell megváltoztatni.

```ts
const createdAssignment = await tx.assignedWork.create({
  data: {
    title: assignment.title.trim(),
    description: assignment.description?.trim() || null,
    assignedById: userId,
    classroomId: id,
    ...assignmentDeadline!,
    isGraded: assignment.isGraded,
    maxPoints: assignment.maxPoints
      ? parseFloat(assignment.maxPoints)
      : null,
  },
});

await tx.event.create({
  data: {
    title: `Assignment: ${assignment.title.trim()}`,
    startDate: assignmentDeadline!.deadlineAt,
    endDate: assignmentDeadline!.deadlineAt,
    isAllDay: !assignment.dueTime,
    isProtected: true,
    classroomId: id,
    assignmentId: createdAssignment.id,
  },
});
```

Forrás: [`app/api/classrooms/[id]/posts/route.ts`](../app/api/classrooms/%5Bid%5D/posts/route.ts)

## 5. AI-válasz ellenőrzése engedélyezett kurzuslistával

**Javasolt hely:** az 1.1.2. alfejezet napi AI-ajánlásokat ismertető része után.

**Javasolt felvezető szöveg:**

> A nyelvi modell strukturált választ ad, de az eredményét a szerver nem fogadja el automatikusan. A visszakapott azonosítónak szerepelnie kell az előzetesen összeállított, hozzáférhető kurzusok listájában, majd mentés után ismét ellenőrzöm a kurzus elérhetőségét.

```ts
const availableContext = selectableCandidates.map(candidateContext);
const promptContext = JSON.stringify({
  completedCourses: completedContext,
  availableCourses: availableContext,
}).slice(0, 12_000);

const { object } = await generateObject({
  model: deepseek("deepseek-chat"),
  schema: selectionSchema,
  maxOutputTokens: 80,
  system: "You select one educational course for a learner. Return only an exact course ID from the availableCourses list. Never invent an ID.",
  prompt: `${strategy}\n\n${promptContext}`,
});

const selected = selectableCandidates.find(
  (candidate) => candidate.id === object.courseId,
);
if (!selected) {
  throw new Error("The recommendation model returned an unavailable course");
}
```

Forrás: [`lib/ai/course-recommendations.ts`](../lib/ai/course-recommendations.ts)

## 6. Többrétegű fájlellenőrzés

**Javasolt hely:** az 1.1.9. alfejezet fájltípus- és MIME-ellenőrzést bemutató bekezdése után.

**Javasolt felvezető szöveg:**

> A feltöltött fájl elfogadásához az engedélyezett kiterjesztés, a kliens által megadott MIME-típus és a bináris tartalomból felismert formátum egyezése is szükséges. A felhasználási cél ezen felül további korlátozásokat határoz meg.

```ts
const extension = path.extname(file.name).slice(1).toLowerCase();
const expected = EXTENSIONS[extension];
if (!expected) {
  throw new UploadValidationError("Unsupported file extension");
}

if (purpose === "TICKET_ATTACHMENT" && expected.type !== "IMAGE") {
  throw new UploadValidationError(
    "Ticket attachments must be JPEG, PNG, GIF, or WebP images",
  );
}

const buffer = Buffer.from(await file.arrayBuffer());
const detected = extension === "txt" || extension === "csv"
  ? undefined
  : await fileTypeFromBuffer(Uint8Array.from(buffer));

let detectedMime: string;
if (extension === "txt" || extension === "csv") {
  if (!isSafeText(buffer)) {
    throw new UploadValidationError("Text files must contain valid UTF-8 without control bytes");
  }
  detectedMime = expected.mime;
} else {
  const acceptedMimes = MIME_ALIASES[expected.mime] ?? [expected.mime];
  if (!detected || !acceptedMimes.includes(detected.mime)) {
    throw new UploadValidationError("File contents do not match the extension");
  }
  detectedMime = detected.mime;
}

const declared = file.type.toLowerCase();
const acceptedDeclared = MIME_ALIASES[expected.mime] ?? [expected.mime];
if (declared && !acceptedDeclared.includes(declared)) {
  throw new UploadValidationError(
    "Declared MIME type does not match the file contents",
  );
}
```

Forrás: [`lib/files/validation.ts`](../lib/files/validation.ts)

## 7. HTML-tartalom szerveroldali tisztítása

**Javasolt hely:** az 1.1.3. alfejezet formázott HTML-tartalom tisztításáról szóló bekezdése után, vagy az 1.1.9. biztonsági részében.

**Javasolt felvezető szöveg:**

> A szerkesztőből és az AI-funkciókból származó HTML-t ugyanaz a szerveroldali tisztító dolgozza fel. A megoldás engedélyezési listával korlátozza a megtartható elemeket, attribútumokat, stílusokat és URL-protokollokat.

```ts
return sanitizeHtml(value, {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    span: ["style"],
    mark: ["style", "data-color"],
  },
  allowedStyles: {
    span: { color: [COLOR], "background-color": [COLOR] },
    mark: { color: [COLOR], "background-color": [COLOR] },
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  enforceHtmlBoundary: true,
});
```

Forrás: [`lib/security/rich-text.ts`](../lib/security/rich-text.ts)

## Szerkesztési javaslat

A dolgozat törzsszövegébe ezek közül négy vagy öt példa elegendő. A legerősebb válogatás:

1. biztonságos regisztráció;
2. központosított jogosultságkezelés;
3. optimista átrendezés visszaállítással;
4. feladat és naptári esemény tranzakciója;
5. AI-válasz szerveroldali ellenőrzése;
6. többrétegű fájlellenőrzés.

Az egyes kódrészletek alatt érdemes feltüntetni a forrásfájl nevét, valamint a dolgozatban használt sorszámozásnak megfelelően például a **„1. kódrészlet: A regisztráció biztonsági lépései”** képaláírást.
