# Database Models

The models below follow the order of `prisma/schema.prisma`. Each section describes one persisted entity and only its direct relationships.

### User

```prisma
model User {
  id             String    @id @default(cuid())
  email          String    @unique
  name           String
  password       String?
  emailVerified  DateTime?
  image          String?
  bannerImageUrl String?
  imageFileId    String?   @unique
  bannerFileId   String?   @unique
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  accounts    Account[]
  sessions    Session[]
  storedFiles StoredFile[] @relation("StoredFileOwner")
  imageFile   StoredFile?  @relation("UserImage", fields: [imageFileId], references: [id], onDelete: SetNull)
  bannerFile  StoredFile?  @relation("UserBanner", fields: [bannerFileId], references: [id], onDelete: SetNull)

  createdCourses             Course[]                    @relation("CourseCreator")
  createdClassrooms          Classroom[]
  classroomMemberships       ClassroomMember[]
  courseEnrollments          CourseEnrollment[]
  courseProgress             CourseProgress[]
  createdTests               Test[]
  personalEvents             Event[]                     @relation("PersonalEvents")
  assignedWorkAsTeacher      AssignedWork[]              @relation("WorkAssigner")
  reminders                  Reminder[]
  notifications              Notification[]
  gradesAsStudent            Grade[]                     @relation("StudentGrade")
  gradesAsGrader             Grade[]                     @relation("Grader")
  streak                     Streak?
  focusSessions              FocusSession[]
  uploadedFiles              Attachment[]
  testAttempts               TestAttempt[]
  settings                   UserSettings?
  courseRatings              CourseRating[]
  reports                    Report[]                    @relation("ReportReporter")
  reviewedReports            Report[]                    @relation("ReportReviewer")
  classroomPosts             ClassroomPost[]
  comments                   Comment[]
  submissions                Submission[]
  courseAccessGrants         CourseAccess[]
  activityRecords            ActivityRecord[]
  aiUsageQuotas              AiUsageQuota[]
  dailyCourseRecommendations DailyCourseRecommendation[]
}
```

**Purpose:**
`User` represents a registered person and is the central identity entity of the application. It stores authentication, profile, preference, learning, teaching, and activity associations.

**Fields:**
`email` is the unique sign-in address, while `name` is the displayed name. `password` is optional because an account may use an external authentication provider. `emailVerified` records verification. `image` is the single profile-image URL used for both provider images and uploaded BeeSmart profile images, while `bannerImageUrl` stores the banner reference. `imageFileId` and `bannerFileId` are unique optional foreign keys when these images are backed by managed `StoredFile` records.

**Relationships:**
A user can have many authentication accounts and sessions, own many stored files, and optionally select one file as a profile image and one as a banner. The remaining collection fields express one-to-many relationships with courses, classrooms, memberships, enrollments, progress records, tests, events, assigned work, reminders, notifications, grades, focus sessions, uploads, attempts, ratings, reports, posts, comments, submissions, access grants, activities, AI quotas, and recommendations. `streak` and `settings` are optional one-to-one relationships. Named relations distinguish multiple links to the same model, such as grades received versus grades awarded. Most dependent records are deleted when the user is deleted; image, banner, grader, and reviewer references are set to null where declared by the related model.

### Account

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}
```

**Purpose:**
`Account` stores an authentication account supplied by an external provider and links it to an application user.

**Fields:**
`type`, `provider`, and `providerAccountId` identify the authentication mechanism and the provider-side account. The token, expiry, scope, and session fields store provider credentials and related authorization metadata. The provider and provider account identifier form a unique pair.

**Relationships:**
Each account belongs to one `User`. `userId` is the foreign key, so one user may have many linked accounts. Deleting the user also deletes these account records.

### Session

```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

**Purpose:**
`Session` represents an authenticated user session and allows the application to associate a session token with a user for a limited period.

**Fields:**
`sessionToken` is the unique token used to identify the session, and `expires` defines when it is no longer valid.

**Relationships:**
Each session belongs to one `User` through the `userId` foreign key. A user may have many sessions, and they are removed if the user is deleted.

### VerificationToken

```prisma
model VerificationToken {
  identifier String
  token      String
  expires    DateTime

  @@unique([identifier, token])
}
```

**Purpose:**
`VerificationToken` stores temporary tokens used by authentication flows that must verify an identifier, such as an email address.

**Fields:**
`identifier` names the identity being verified, `token` contains the verification value, and `expires` limits its validity. The combination of identifier and token is unique.

**Relationships:**
This model has no Prisma relation or foreign key. Its association with an identity is represented only by the textual `identifier` value.

### Classroom

```prisma
model Classroom {
  id          String   @id @default(cuid())
  name        String
  description String?
  code        String   @unique
  subject     String?
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  creator      User              @relation(fields: [createdById], references: [id], onDelete: Cascade)
  members      ClassroomMember[]
  events       Event[]
  assignedWork AssignedWork[]
  posts        ClassroomPost[]
  tests        Test[]
  courseLinks  ClassroomCourse[]

  @@index([createdById])
}
```

**Purpose:**
`Classroom` represents a teaching group in which users can participate, receive work, view scheduled items, and access shared learning content.

**Fields:**
`name`, optional `description`, and optional `subject` describe the group. `code` is a unique classroom identifier suitable for joining or locating the classroom. `createdById` identifies its creator.

**Relationships:**
Each classroom belongs to one creator through the `createdById` foreign key to `User`. It has one-to-many relationships with memberships, events, assigned work, posts, tests, and course-link records. The `ClassroomCourse` link records create a many-to-many association between classrooms and courses. Deleting a classroom cascades to the dependent relations where their models specify cascade deletion.

### ClassroomMember

```prisma
model ClassroomMember {
  id          String        @id @default(cuid())
  userId      String
  classroomId String
  role        ClassroomRole
  joinedAt    DateTime      @default(now())

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  classroom Classroom @relation(fields: [classroomId], references: [id], onDelete: Cascade)

  @@unique([userId, classroomId])
  @@index([userId])
  @@index([classroomId])
}
```

**Purpose:**
`ClassroomMember` records a user’s membership in a classroom and the role held there.

**Fields:**
`role` distinguishes teachers, students, and teaching assistants. `joinedAt` records when the membership began. The unique pair of `userId` and `classroomId` prevents duplicate membership in the same classroom.

**Relationships:**
Each membership belongs to one `User` and one `Classroom`; both identifiers are foreign keys. Consequently, users and classrooms have a many-to-many relationship resolved through this model. Deleting either side removes the membership.

### Course

```prisma
model Course {
  id                String           @id @default(cuid())
  title             String
  description       String?
  coverImageUrl     String?
  coverStoredFileId String?          @unique
  createdById       String
  visibility        CourseVisibility @default(PRIVATE)
  published         Boolean          @default(false)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  creator              User                        @relation("CourseCreator", fields: [createdById], references: [id], onDelete: Cascade)
  coverStoredFile      StoredFile?                 @relation("CourseCover", fields: [coverStoredFileId], references: [id], onDelete: SetNull)
  modules              CourseModule[]
  enrollments          CourseEnrollment[]
  progress             CourseProgress[]
  files                Attachment[]
  tags                 CourseTag[]
  ratings              CourseRating[]
  reports              Report[]
  classroomPosts       ClassroomPost[]
  classroomLinks       ClassroomCourse[]
  accessGrants         CourseAccess[]
  dailyRecommendations DailyCourseRecommendation[]

  @@index([createdById])
}
```

**Purpose:**
`Course` represents a structured learning resource created by a user. It is the parent entity for course content and records how the course is published, discovered, accessed, and evaluated.

**Fields:**
`title` and `description` describe the course. `coverImageUrl` can hold an image reference, while `coverStoredFileId` uniquely links to a managed cover file. `visibility` controls the intended access category, and `published` records whether the course is released. `createdById` identifies the creator.

**Relationships:**
Each course has one creator (`createdById` → `User.id`) and optionally one managed cover file (`coverStoredFileId` → `StoredFile.id`). It has many modules, enrollments, progress records, attachments, tag links, ratings, reports, classroom posts, classroom links, access grants, and daily recommendations. `CourseTag` and `ClassroomCourse` implement many-to-many associations with tags and classrooms. If the cover file is deleted, its foreign key is set to null.

### CourseModule

```prisma
model CourseModule {
  id          String   @id @default(cuid())
  courseId    String
  title       String
  description String?
  order       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  course  Course         @relation(fields: [courseId], references: [id], onDelete: Cascade)
  lessons CourseLesson[]

  @@index([courseId])
}
```

**Purpose:**
`CourseModule` represents an ordered section within a course and groups related lessons.

**Fields:**
`title` and optional `description` identify the section, while `order` controls its position in the course.

**Relationships:**
Each module belongs to one `Course` through the `courseId` foreign key, and one course may contain many modules. A module contains many `CourseLesson` records. Deleting the course cascades to its modules, and deleting a module cascades to its lessons.

### CourseLesson

```prisma
model CourseLesson {
  id           String   @id @default(cuid())
  moduleId     String
  title        String
  description  String?
  content      String?  @db.Text
  contentDraft String?  @db.Text
  order        Int      @default(0)
  isLocked     Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  module   CourseModule     @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  files    Attachment[]
  progress CourseProgress[]

  @@index([moduleId])
}
```

**Purpose:**
`CourseLesson` stores an individual learning unit inside a course module, including its published and draft textual content.

**Fields:**
`title` and `description` identify the lesson. `content` stores lesson material, whereas `contentDraft` preserves a draft version. `order` determines placement within the module, and `isLocked` records whether access is restricted.

**Relationships:**
Each lesson belongs to one `CourseModule` through `moduleId`; a module may contain many lessons. A lesson can have many attachments and many learner progress records. Deleting the module also deletes its lessons.

### CourseEnrollment

```prisma
model CourseEnrollment {
  id          String    @id @default(cuid())
  userId      String
  courseId    String
  enrolledAt  DateTime  @default(now())
  completedAt DateTime?

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  course Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([userId, courseId])
  @@index([userId])
  @@index([courseId])
}
```

**Purpose:**
`CourseEnrollment` records that a user is enrolled in a course and whether that enrollment has been completed.

**Fields:**
`enrolledAt` records the start of the enrollment, and optional `completedAt` records course completion. The unique user-course pair allows only one enrollment per user in each course.

**Relationships:**
Each enrollment belongs to one `User` and one `Course`, with `userId` and `courseId` serving as foreign keys. It therefore resolves a many-to-many relationship between users and courses. Deleting either related record removes the enrollment.

### CourseProgress

```prisma
model CourseProgress {
  id             String    @id @default(cuid())
  userId         String
  courseId       String
  lessonId       String
  completedAt    DateTime?
  lastAccessedAt DateTime  @default(now())

  user   User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  course Course       @relation(fields: [courseId], references: [id], onDelete: Cascade)
  lesson CourseLesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@unique([userId, lessonId])
  @@index([userId])
  @@index([courseId])
  @@index([lessonId])
}
```

**Purpose:**
`CourseProgress` stores a user’s progress for a particular lesson within a course.

**Fields:**
`completedAt` marks completion when present, and `lastAccessedAt` records the most recent access. The unique pair of `userId` and `lessonId` permits one progress record per user and lesson.

**Relationships:**
Each progress record belongs to one `User`, one `Course`, and one `CourseLesson`; all three identifiers are foreign keys. Users, courses, and lessons can each have many progress records. Deleting any referenced record removes the associated progress record.

### Test

```prisma
model Test {
  id           String    @id @default(cuid())
  classroomId  String?
  title        String
  description  String?
  type         TestType
  timeLimit    Int?
  passingScore Float?
  opensAt      DateTime?
  closesAt     DateTime?
  maxAttempts  Int       @default(1)
  createdById  String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  classroom     Classroom?      @relation(fields: [classroomId], references: [id], onDelete: Cascade)
  creator       User            @relation(fields: [createdById], references: [id], onDelete: Cascade)
  questions     TestQuestion[]
  attempts      TestAttempt[]
  posts         ClassroomPost[]
  calendarEvent Event?

  @@index([createdById])
}
```

**Purpose:**
`Test` represents an assessment created by a user, classified as either a test or an exam and optionally assigned to a classroom.

**Fields:**
`title` and optional `description` identify the assessment. `type` distinguishes a test from an exam. `timeLimit`, `passingScore`, `opensAt`, `closesAt`, and `maxAttempts` define its assessment constraints. `createdById` identifies the author, while `classroomId` optionally places it in a classroom.

**Relationships:**
Each test has one creator through `createdById` and may belong to one `Classroom` through `classroomId`. It has many questions, attempts, and classroom posts, and may be linked to one calendar `Event`. A creator or classroom can have many tests. The declared foreign-key deletions cascade.

### TestQuestion

```prisma
model TestQuestion {
  id           String       @id @default(cuid())
  testId       String
  questionText String       @db.Text
  questionType QuestionType
  order        Int          @default(0)
  points       Float        @default(1)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  test      Test                  @relation(fields: [testId], references: [id], onDelete: Cascade)
  options   TestQuestionOption[]
  answers   TestAnswer[]
  responses TestAttemptResponse[]

  @@index([testId])
}
```

**Purpose:**
`TestQuestion` stores one ordered question within an assessment and defines how it should be answered and scored.

**Fields:**
`questionText` contains the prompt. `questionType` identifies the response format, such as multiple choice, true/false, short answer, or essay. `order` determines position, and `points` gives the question’s score value.

**Relationships:**
Each question belongs to one `Test` through the `testId` foreign key. A question may have many answer options, accepted-answer records, and attempt responses. Deleting the test cascades to its questions.

### TestQuestionOption

```prisma
model TestQuestionOption {
  id         String  @id @default(cuid())
  questionId String
  optionText String  @db.Text
  isCorrect  Boolean @default(false)
  order      Int     @default(0)

  question  TestQuestion          @relation(fields: [questionId], references: [id], onDelete: Cascade)
  responses TestAttemptResponse[]

  @@index([questionId])
}
```

**Purpose:**
`TestQuestionOption` represents one selectable option for a question, including whether the option is considered correct.

**Fields:**
`optionText` stores the displayed choice, `isCorrect` marks its correctness, and `order` controls its position among the options.

**Relationships:**
Each option belongs to one `TestQuestion` through `questionId`, and a question may have many options. An option may be selected by many `TestAttemptResponse` records. Deleting the question deletes its options; deleting an option sets existing `selectedOptionId` references to null.

### TestAnswer

```prisma
model TestAnswer {
  id         String   @id @default(cuid())
  questionId String
  answerText String?  @db.Text
  isCorrect  Boolean?

  question TestQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@index([questionId])
}
```

**Purpose:**
`TestAnswer` stores an answer definition associated with a test question, including optional text and an optional correctness value.

**Fields:**
`answerText` contains the answer content when a textual answer is applicable. `isCorrect` can explicitly classify the answer, while a null value leaves that classification unspecified.

**Relationships:**
Each answer belongs to one `TestQuestion` through the `questionId` foreign key, and a question may have many answer records. Answers are deleted when their question is deleted.

### TestAttempt

```prisma
model TestAttempt {
  id            String    @id @default(cuid())
  testId        String
  userId        String
  attemptNumber Int       @default(1)
  startedAt     DateTime  @default(now())
  submittedAt   DateTime?
  score         Float?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  test      Test                  @relation(fields: [testId], references: [id], onDelete: Cascade)
  user      User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  responses TestAttemptResponse[]

  @@unique([testId, userId, attemptNumber])
  @@index([testId])
  @@index([userId])
}
```

**Purpose:**
`TestAttempt` records one user’s individual attempt at completing a test.

**Fields:**
`attemptNumber` distinguishes repeated attempts by the same user. `startedAt` records when work began, while a non-null `submittedAt` is the authoritative indication that the attempt has finished. `score` stores the resulting percentage when grading is complete. The test-user-attempt number combination is unique.

**Relationships:**
Each attempt belongs to one `Test` and one `User` through the `testId` and `userId` foreign keys. It contains many `TestAttemptResponse` records. Deleting the test or user removes the attempt.

### TestAttemptResponse

```prisma
model TestAttemptResponse {
  id               String   @id @default(cuid())
  attemptId        String
  questionId       String
  responseText     String?  @db.Text
  selectedOptionId String?
  isCorrect        Boolean?
  pointsAwarded    Float?
  teacherComment   String?  @db.Text
  createdAt        DateTime @default(now())

  attempt        TestAttempt         @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  question       TestQuestion        @relation(fields: [questionId], references: [id], onDelete: Cascade)
  selectedOption TestQuestionOption? @relation(fields: [selectedOptionId], references: [id], onDelete: SetNull)

  @@unique([attemptId, questionId])
  @@index([attemptId])
  @@index([questionId])
}
```

**Purpose:**
`TestAttemptResponse` stores the answer given to one question during a particular test attempt, together with grading information.

**Fields:**
`responseText` holds a written response, while `selectedOptionId` identifies a chosen option when applicable. `isCorrect`, `pointsAwarded`, and `teacherComment` store the evaluation. The attempt-question pair is unique, so an attempt has at most one response per question.

**Relationships:**
Each response belongs to one `TestAttempt` and one `TestQuestion` through required foreign keys. It may also reference one `TestQuestionOption` through the optional `selectedOptionId` foreign key. Attempts, questions, and options can each be associated with many responses. Deleting the attempt or question removes the response; deleting the selected option preserves the response and sets the option reference to null.

### Event

```prisma
model Event {
  id                String             @id @default(cuid())
  title             String
  description       String?            @db.Text
  startDate         DateTime
  endDate           DateTime
  startTime         String?
  endTime           String?
  isAllDay          Boolean            @default(false)
  order             Int                @default(0)
  userId            String?
  classroomId       String?
  testId            String?            @unique
  assignmentId      String?            @unique
  isProtected       Boolean            @default(false)
  color             String?
  recurrencePattern RecurrencePattern?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  user       User?         @relation("PersonalEvents", fields: [userId], references: [id], onDelete: Cascade)
  classroom  Classroom?    @relation(fields: [classroomId], references: [id], onDelete: Cascade)
  test       Test?         @relation(fields: [testId], references: [id], onDelete: Cascade)
  assignment AssignedWork? @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  reminders  Reminder[]

  @@index([userId])
  @@index([classroomId])
  @@index([startDate])
}
```

**Purpose:**
`Event` represents an item placed on a personal or classroom calendar. It may also provide the calendar representation of a test or an assignment.

**Fields:**
`title` and `description` describe the event. `startDate`, `endDate`, optional time strings, and `isAllDay` define its schedule. `order` supports ordering, `isProtected` marks protected entries, `color` stores display categorisation, and `recurrencePattern` optionally defines daily, weekly, or monthly recurrence. The optional owner and source identifiers determine its context.

**Relationships:**
An event may belong to one `User` as a personal event or to one `Classroom`. It may reference one `Test` or one `AssignedWork`; the unique `testId` and `assignmentId` fields make both relationships optional one-to-one associations. An event can have many reminders. All four identifiers are foreign keys, and the declared deletions cascade.

### AssignedWork

```prisma
model AssignedWork {
  id               String   @id @default(cuid())
  title            String
  description      String?  @db.Text
  assignedById     String
  classroomId      String?
  deadlineAt       DateTime
  deadlineTimeZone String
  deadlineHasTime  Boolean  @default(false)
  isGraded         Boolean  @default(true)
  maxPoints        Float?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  assigner      User            @relation("WorkAssigner", fields: [assignedById], references: [id], onDelete: Cascade)
  classroom     Classroom?      @relation(fields: [classroomId], references: [id], onDelete: Cascade)
  grades        Grade[]
  submissions   Submission[]
  posts         ClassroomPost[]
  calendarEvent Event?

  @@index([assignedById])
  @@index([classroomId])
  @@index([deadlineAt])
}
```

**Purpose:**
`AssignedWork` represents a task assigned by a user, optionally within a classroom, with a defined deadline and grading configuration.

**Fields:**
`title` and `description` describe the work. `deadlineAt`, `deadlineTimeZone`, and `deadlineHasTime` preserve the due moment and whether an exact time applies. `isGraded` states whether grading is expected, and `maxPoints` optionally defines the maximum score. `assignedById` identifies the assigning user.

**Relationships:**
Each record has one assigning `User` through `assignedById` and may belong to one `Classroom` through `classroomId`. It can have many grades, submissions, and classroom posts, plus an optional one-to-one calendar event. The required and optional owner identifiers are foreign keys with cascade deletion.

### Reminder

```prisma
model Reminder {
  id                      String    @id @default(cuid())
  userId                  String
  task                    String
  date                    DateTime
  time                    String?
  timeZone                String?
  dueAt                   DateTime?
  notifyAt                DateTime?
  notificationProcessedAt DateTime?
  eventId                 String
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  event Event @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@unique([userId, eventId])
  @@index([userId])
  @@index([eventId])
  @@index([date])
  @@index([dueAt])
  @@index([notifyAt])
}
```

**Purpose:**
`Reminder` stores a user-specific reminder associated with a calendar event and tracks when a notification should be processed.

**Fields:**
`task` stores the reminder text. `date`, optional `time`, and optional `timeZone` preserve the user-facing schedule; `dueAt` and `notifyAt` can store calculated moments. `notificationProcessedAt` records that notification handling has occurred. The unique user-event pair allows one reminder per user for an event.

**Relationships:**
Each reminder belongs to one `User` and one `Event`, with `userId` and `eventId` as foreign keys. Users and events may each have many reminders. Deleting either referenced entity removes the reminder.

### Notification

```prisma
model Notification {
  id            String               @id @default(cuid())
  userId        String
  title         String
  body          String               @db.Text
  type          NotificationType
  category      NotificationCategory @default(GENERAL)
  readAt        DateTime?
  relatedId     String?
  relatedType   String?
  classroomId   String?
  classroomName String?
  actorId       String?
  actorName     String?
  actionUrl     String?
  createdAt     DateTime             @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([readAt])
  @@index([category])
  @@index([classroomId])
  @@index([createdAt])
}
```

**Purpose:**
`Notification` stores a message presented to a specific user, including its category, context, and read state.

**Fields:**
`title` and `body` contain the message. `type` classifies its subject and `category` distinguishes general and classroom notifications. `readAt` marks it as read. `relatedId` and `relatedType` provide generic contextual references, while the classroom, actor, and action fields store denormalised display or navigation information.

**Relationships:**
Each notification belongs to one `User` through the `userId` foreign key, and a user may have many notifications. Deleting the user deletes the notifications. Although `relatedId`, `classroomId`, and `actorId` may contain identifiers, the schema does not declare them as foreign keys or Prisma relations.

### ClassroomCourse

```prisma
model ClassroomCourse {
  id          String   @id @default(cuid())
  classroomId String
  courseId    String
  addedById   String
  createdAt   DateTime @default(now())

  classroom Classroom @relation(fields: [classroomId], references: [id], onDelete: Cascade)
  course    Course    @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([classroomId, courseId])
  @@index([classroomId])
  @@index([courseId])
}
```

**Purpose:**
`ClassroomCourse` records that a course has been added to a classroom and acts as the link between these two entities.

**Fields:**
`classroomId` and `courseId` identify the linked records. `addedById` stores the identifier of the user who added the course. The unique classroom-course pair prevents the same course from being linked to one classroom more than once.

**Relationships:**
Each record belongs to one `Classroom` and one `Course` through declared foreign keys. Together, these records implement a many-to-many relationship between classrooms and courses. Deleting either related record deletes the link. `addedById` is not declared as a foreign key or relation to `User` in the schema.

### CourseAccess

```prisma
model CourseAccess {
  id          String   @id @default(cuid())
  courseId    String
  userId      String
  invitedById String
  createdAt   DateTime @default(now())

  course Course @relation(fields: [courseId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([courseId, userId])
  @@index([userId])
}
```

**Purpose:**
`CourseAccess` stores an explicit grant that allows a particular user to access a course.

**Fields:**
`courseId` and `userId` identify the course and recipient. `invitedById` records the identifier of the inviting user. The unique course-user pair prevents duplicate grants.

**Relationships:**
Each access grant belongs to one `Course` and one `User` through foreign keys, while both courses and users may have many grants. Deleting either referenced entity removes the grant. `invitedById` is a scalar identifier and is not defined as a foreign key or Prisma relation.

### ActivityRecord

```prisma
model ActivityRecord {
  id           String   @id @default(cuid())
  userId       String
  activityType String
  courseId     String?
  classroomId  String?
  relatedId    String?
  dedupeKey    String   @unique
  createdAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([activityType])
  @@index([classroomId])
  @@index([courseId])
  @@index([createdAt])
}
```

**Purpose:**
`ActivityRecord` stores a user activity entry that can be classified and associated with contextual application entities.

**Fields:**
`activityType` describes the kind of activity. Optional `courseId`, `classroomId`, and `relatedId` store contextual identifiers. `dedupeKey` is unique and prevents the same logical activity from being recorded more than once.

**Relationships:**
Each activity record belongs to one `User` through the `userId` foreign key, and a user may have many records. Deleting the user removes the activities. The course, classroom, and related identifiers are indexed scalar fields but are not declared as foreign keys or Prisma relations.

### Grade

```prisma
model Grade {
  id             String    @id @default(cuid())
  userId         String
  assignedWorkId String
  score          Float
  maxScore       Float?
  feedback       String?   @db.Text
  gradedById     String?
  gradedAt       DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  student      User         @relation("StudentGrade", fields: [userId], references: [id], onDelete: Cascade)
  assignedWork AssignedWork @relation(fields: [assignedWorkId], references: [id], onDelete: Cascade)
  grader       User?        @relation("Grader", fields: [gradedById], references: [id], onDelete: SetNull)

  @@unique([userId, assignedWorkId])
  @@index([assignedWorkId])
}
```

**Purpose:**
`Grade` stores a student’s score and feedback for a particular assigned work item.

**Fields:**
`score` contains the awarded value and `maxScore` optionally records the scale used. `feedback` stores written evaluation. `gradedById` and `gradedAt` identify who graded the work and when.

**Relationships:**
Each grade belongs to one student (`userId` → `User.id`) and one `AssignedWork` item (`assignedWorkId` → `AssignedWork.id`). The composite uniqueness constraint permits one grade per student and assigned work item. A grade may also reference one grader through `gradedById` → `User.id`. A user can receive many grades and award many grades, while an assigned work item can have many grades for different students. Deleting the student or work deletes the grade; deleting the grader sets `gradedById` to null.

### Streak

```prisma
model Streak {
  id               String    @id @default(cuid())
  userId           String    @unique
  currentStreak    Int       @default(0)
  longestStreak    Int       @default(0)
  lastActivityDate DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Purpose:**
`Streak` stores a user’s current and historical activity streak statistics.

**Fields:**
`currentStreak` contains the active streak length, `longestStreak` preserves the best recorded length, and `lastActivityDate` stores the most recent qualifying activity date.

**Relationships:**
Each streak belongs to exactly one `User` through the unique `userId` foreign key. The uniqueness constraint creates a one-to-one relationship: a user can have at most one streak record. Deleting the user deletes the streak.

### FocusSession

```prisma
model FocusSession {
  id              String           @id @default(cuid())
  userId          String
  completionId    String?          @unique
  durationSeconds Int
  type            FocusSessionType
  startedAt       DateTime
  endedAt         DateTime
  createdAt       DateTime         @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([startedAt])
}
```

**Purpose:**
`FocusSession` records a timed period associated with a user, classified as either active focus or a break.

**Fields:**
`durationSeconds`, `startedAt`, and `endedAt` describe the session’s length and boundaries. `type` distinguishes active and break periods. Optional `completionId` is unique and can identify a particular completion event without duplication.

**Relationships:**
Each session belongs to one `User` through the `userId` foreign key, and a user may have many focus sessions. Deleting the user removes the sessions. `completionId` is not declared as a relation.

### Tag

```prisma
model Tag {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  courses CourseTag[]
}
```

**Purpose:**
`Tag` represents a reusable label used to categorise courses.

**Fields:**
`name` stores the human-readable label, while the unique `slug` provides a stable, URL-friendly identifier.

**Relationships:**
A tag may appear in many `CourseTag` link records. Through those records, tags and courses have a many-to-many relationship. This model contains no direct foreign key.

### CourseTag

```prisma
model CourseTag {
  id       String @id @default(cuid())
  courseId String
  tagId    String

  course Course @relation(fields: [courseId], references: [id], onDelete: Cascade)
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@unique([courseId, tagId])
  @@index([courseId])
  @@index([tagId])
}
```

**Purpose:**
`CourseTag` assigns a tag to a course and serves as the junction entity for course categorisation.

**Fields:**
`courseId` and `tagId` identify the linked course and tag. Their unique combination prevents the same tag from being assigned to a course more than once.

**Relationships:**
Each link belongs to one `Course` and one `Tag`, with both fields acting as foreign keys. The model implements a many-to-many relationship because a course can have many tags and a tag can classify many courses. Deleting either side removes the link.

### CourseRating

```prisma
model CourseRating {
  id        String   @id @default(cuid())
  userId    String
  courseId  String
  rating    Int // 1-5 stars
  comment   String?  @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  course Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([userId, courseId])
  @@index([userId])
  @@index([courseId])
  @@index([rating])
}
```

**Purpose:**
`CourseRating` stores a user’s evaluation of a course, expressed as a star rating with an optional written comment.

**Fields:**
`rating` stores the score on the schema-documented one-to-five scale, and `comment` stores an optional explanation. The unique user-course pair permits one rating from each user for a course.

**Relationships:**
Each rating belongs to one `User` and one `Course` through the `userId` and `courseId` foreign keys. Users and courses can each have many ratings. Deleting either related record deletes the rating.

### Report

```prisma
model Report {
  id           String       @id @default(cuid())
  userId       String // User who made the report or whose content was flagged
  courseId     String? // Course being reported, when applicable
  type         ReportType   @default(COURSE_REPORT)
  reason       String       @db.Text
  description  String?      @db.Text
  status       ReportStatus @default(OPEN)
  reviewedAt   DateTime?
  reviewedById String? // Admin who reviewed
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  reporter    User         @relation("ReportReporter", fields: [userId], references: [id], onDelete: Cascade)
  course      Course?      @relation(fields: [courseId], references: [id], onDelete: SetNull)
  reviewer    User?        @relation("ReportReviewer", fields: [reviewedById], references: [id], onDelete: SetNull)
  attachments Attachment[]

  @@index([userId])
  @@index([courseId])
  @@index([status])
  @@index([createdAt])
}
```

**Purpose:**
`Report` stores a submitted or automated report that can be reviewed and resolved. Depending on its type, it may concern a course, early-access feedback, or an automatically flagged course.

**Fields:**
`type` classifies the report, `reason` states its basis, and `description` provides optional detail. `status` records the review stage. `reviewedAt` and `reviewedById` record the review when one occurs. `userId` identifies the reporting user or, as the schema comment notes, the user whose content was flagged; `courseId` identifies the reported course when applicable.

**Relationships:**
Each report has one reporter through `userId` → `User.id`, may concern one `Course` through `courseId`, and may have one reviewer through `reviewedById` → `User.id`. Named relations separate reporter and reviewer roles. A report can have many attachments. Deleting the reporter deletes the report, whereas deleting the course or reviewer sets the relevant foreign key to null.

### UserSettings

```prisma
model UserSettings {
  id                              String            @id @default(cuid())
  userId                          String            @unique
  theme                           String            @default("bee")
  courseCreationTutorialCompleted Boolean           @default(false)
  defaultActiveMinutes            Int               @default(45)
  defaultBreakMinutes             Int               @default(15)
  defaultAutoBreak                Boolean           @default(true)
  reminderNotifications           Boolean           @default(true)
  classroomNotifications          Boolean           @default(true)
  profileVisibility               ProfileVisibility @default(PRIVATE)
  activitySharing                 Boolean           @default(true)
  createdAt                       DateTime          @default(now())
  updatedAt                       DateTime          @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Purpose:**
`UserSettings` stores one user’s personal application preferences.

**Fields:**
`theme` selects the visual theme, and `courseCreationTutorialCompleted` records tutorial completion. The active-minute, break-minute, and auto-break fields define default focus-session settings. The notification flags control reminder and classroom notifications. `profileVisibility` sets the profile’s public or private state, and `activitySharing` controls whether activity may be shared.

**Relationships:**
Each settings record belongs to one `User` through the unique `userId` foreign key. This creates a one-to-one relationship in which a user can have at most one settings record. Deleting the user deletes the settings.

### AiUsageQuota

```prisma
model AiUsageQuota {
  id          String          @id @default(cuid())
  userId      String
  category    AiUsageCategory
  periodStart DateTime
  attempts    Int             @default(0)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, category])
  @@index([periodStart])
}
```

**Purpose:**
`AiUsageQuota` tracks a user’s number of AI-assisted attempts for a defined usage category and quota period.

**Fields:**
`category` distinguishes lesson content, syllabus, assessment, and grading usage. `periodStart` identifies the beginning of the tracked period, and `attempts` stores the accumulated count. The user-category pair is unique, so the schema keeps one current quota record per category for each user.

**Relationships:**
Each quota record belongs to one `User` through the `userId` foreign key, while a user may have several quota records for different categories. Deleting the user removes these records.

### DailyCourseRecommendation

```prisma
model DailyCourseRecommendation {
  id          String                   @id @default(cuid())
  userId      String
  courseId    String?
  kind        CourseRecommendationKind
  periodStart DateTime
  createdAt   DateTime                 @default(now())
  updatedAt   DateTime                 @updatedAt

  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  course Course? @relation(fields: [courseId], references: [id], onDelete: SetNull)

  @@unique([userId, kind, periodStart])
  @@index([userId, periodStart])
  @@index([courseId])
}
```

**Purpose:**
`DailyCourseRecommendation` stores a course recommendation assigned to a user for a particular recommendation period and category.

**Fields:**
`kind` distinguishes a highlighted “hive pick” from a suggestion to try something new. `periodStart` identifies the recommendation period. `courseId` is optional, allowing the record to remain even if no course is assigned or the course is later removed. The user-kind-period combination is unique.

**Relationships:**
Each recommendation belongs to one `User` through `userId` and may reference one `Course` through `courseId`. Users and courses may each have many recommendation records. Deleting the user deletes the recommendation; deleting the course sets `courseId` to null.

### ClassroomPost

```prisma
model ClassroomPost {
  id           String    @id @default(cuid())
  classroomId  String
  authorId     String
  type         PostType
  title        String?
  content      String?   @db.Text
  isPinned     Boolean   @default(false)
  assignmentId String?
  testId       String?
  courseId     String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  editedAt     DateTime?

  classroom  Classroom     @relation(fields: [classroomId], references: [id], onDelete: Cascade)
  author     User          @relation(fields: [authorId], references: [id], onDelete: Cascade)
  assignment AssignedWork? @relation(fields: [assignmentId], references: [id], onDelete: SetNull)
  test       Test?         @relation(fields: [testId], references: [id], onDelete: SetNull)
  course     Course?       @relation(fields: [courseId], references: [id], onDelete: SetNull)
  comments   Comment[]
  files      Attachment[]

  @@index([classroomId])
  @@index([authorId])
  @@index([type])
  @@index([createdAt])
}
```

**Purpose:**
`ClassroomPost` represents a message or shared item published in a classroom. Its type allows it to contain ordinary text or media, or to point to an assignment, test, course, or material.

**Fields:**
`type` classifies the post. Optional `title` and `content` hold its text, `isPinned` controls prominence, and `editedAt` records a later edit. `classroomId` and `authorId` identify the location and author. Optional assignment, test, and course identifiers connect the post to shared learning content.

**Relationships:**
Each post belongs to one `Classroom` and one authoring `User` through required foreign keys. It may reference one `AssignedWork`, `Test`, and `Course` through optional foreign keys. A post can have many comments and attachments. Deleting its classroom or author deletes the post; deleting optional linked content sets that reference to null.

### Comment

```prisma
model Comment {
  id           String   @id @default(cuid())
  postId       String?
  submissionId String?
  authorId     String
  content      String   @db.Text
  isPrivate    Boolean  @default(false)
  parentId     String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  post       ClassroomPost? @relation(fields: [postId], references: [id], onDelete: Cascade)
  submission Submission?    @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  author     User           @relation(fields: [authorId], references: [id], onDelete: Cascade)
  parent     Comment?       @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies    Comment[]      @relation("CommentReplies")

  @@index([postId])
  @@index([submissionId])
  @@index([authorId])
  @@index([parentId])
}
```

**Purpose:**
`Comment` stores a user-authored discussion entry attached to a classroom post or a submission. It also supports threaded replies.

**Fields:**
`content` contains the comment text, and `isPrivate` marks comments whose visibility is restricted. Optional `postId` and `submissionId` identify the commented entity. Optional `parentId` identifies the comment being replied to.

**Relationships:**
Each comment has one author through `authorId` → `User.id`. It may belong to one `ClassroomPost` and may belong to one `Submission`; the schema does not itself require exactly one of these targets. The self-relation connects an optional parent comment to many replies, forming a comment thread. All declared relations use cascade deletion.

### Submission

```prisma
model Submission {
  id             String           @id @default(cuid())
  assignedWorkId String
  userId         String
  content        String?          @db.Text
  status         SubmissionStatus @default(PENDING)
  submittedAt    DateTime?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  assignedWork AssignedWork @relation(fields: [assignedWorkId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  files        Attachment[]
  comments     Comment[]

  @@unique([assignedWorkId, userId])
  @@index([assignedWorkId])
  @@index([userId])
}
```

**Purpose:**
`Submission` represents one user’s submitted response to an assigned work item.

**Fields:**
`content` stores the optional written response. `status` tracks whether the work is pending, submitted, late, or graded, and `submittedAt` records submission time. The unique assigned-work and user pair permits one submission per user for each work item.

**Relationships:**
Each submission belongs to one `AssignedWork` record and one `User` through required foreign keys. It can have many file attachments and comments. Deleting the work item or user removes the submission.

### StoredFile

```prisma
model StoredFile {
  id           String          @id @default(cuid())
  ownerId      String
  purpose      UploadPurpose
  storageKey   String          @unique
  originalName String
  detectedMime String
  fileType     FileType
  size         Int
  checksum     String
  scanStatus   FileScanStatus
  state        StoredFileState @default(PENDING)
  expiresAt    DateTime
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  owner       User        @relation("StoredFileOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  imageFor    User?       @relation("UserImage")
  bannerFor   User?       @relation("UserBanner")
  attachment  Attachment?
  courseCover Course?     @relation("CourseCover")

  @@index([ownerId])
  @@index([state, expiresAt])
}
```

**Purpose:**
`StoredFile` contains the authoritative metadata for a file held in managed storage, from initial upload through attachment or pending deletion.

**Fields:**
`purpose` states the intended use of the upload. The unique `storageKey` locates it in storage, while `originalName`, `detectedMime`, `fileType`, and `size` describe it. `checksum` supports content integrity or identification, `scanStatus` stores the security scan result, `state` records its storage lifecycle, and `expiresAt` defines when temporary or pending data expires.

**Relationships:**
Each file is owned by one `User` through `ownerId`, and a user may own many files. A stored file may serve as one user’s profile image, one user’s banner, one attachment, or one course cover through separate optional relations. The unique foreign keys on the other models make these associations one-to-one. Deleting the owner deletes the file; profile-image, banner, and course-cover foreign keys are set to null if their stored file is deleted.

### RateLimitBucket

```prisma
model RateLimitBucket {
  key         String   @id @db.VarChar(191)
  count       Int      @default(0)
  windowStart DateTime
  expiresAt   DateTime
  updatedAt   DateTime @updatedAt

  @@index([expiresAt])
}
```

**Purpose:**
`RateLimitBucket` stores counters used to limit repeated operations within a defined time window.

**Fields:**
`key` uniquely identifies the limited subject or operation. `count` stores the number of recorded uses, `windowStart` marks the beginning of the counting interval, and `expiresAt` indicates when the bucket can be discarded or renewed.

**Relationships:**
This infrastructure model has no Prisma relations or foreign keys.

### Attachment

```prisma
model Attachment {
  id             String    @id @default(cuid())
  courseId       String?
  lessonId       String?
  postId         String?
  submissionId   String?
  reportId       String?
  storedFileId   String?   @unique
  uploadedById   String?
  isVisible      Boolean   @default(true)
  legacyFileName String?
  legacyFileUrl  String?
  legacyFileType FileType?
  legacyFileSize Int?
  createdAt      DateTime  @default(now())

  course     Course?        @relation(fields: [courseId], references: [id], onDelete: Cascade)
  lesson     CourseLesson?  @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  post       ClassroomPost? @relation(fields: [postId], references: [id], onDelete: Cascade)
  submission Submission?    @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  report     Report?        @relation(fields: [reportId], references: [id], onDelete: Cascade)
  uploader   User?          @relation(fields: [uploadedById], references: [id], onDelete: Cascade)
  storedFile StoredFile?    @relation(fields: [storedFileId], references: [id], onDelete: Cascade)

  @@index([courseId])
  @@index([lessonId])
  @@index([postId])
  @@index([submissionId])
  @@index([reportId])
  @@index([uploadedById])
}
```

**Purpose:**
`Attachment` associates an uploaded file with application content such as a course, lesson, classroom post, submission, or report. It supports both managed files and legacy file metadata.

**Fields:**
The optional destination identifiers specify where the attachment belongs. `storedFileId` uniquely links to authoritative metadata in `StoredFile`, while `uploadedById` identifies the uploader. `isVisible` controls visibility. The legacy name, URL, type, and size fields describe uploads that have not been imported into managed storage. As stated in the schema comment, application validation enforces one destination and prevents managed files from retaining copied legacy metadata; these rules are not database constraints in this model.

**Relationships:**
An attachment may belong to one `Course`, `CourseLesson`, `ClassroomPost`, `Submission`, or `Report`, and may reference one uploader `User`. It may also have one `StoredFile`; the unique `storedFileId` produces a one-to-one association. Each destination entity and user can have many attachments. All declared relations use cascade deletion.
