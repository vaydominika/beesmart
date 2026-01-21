export interface User {
  name: string;
  role: string;
  avatar?: string;
}

export interface LearningCourse {
  id: string;
  title: string;
  description: string;
  progress?: number;
}

export interface Reminder {
  id: string;
  task: string;
  date: string;
  time: string;
}

export const mockUser: User = {
  name: "YOUR NAME",
  role: "ROLE",
};

export const mockStreak = 5;

export const mockContinueLearning: LearningCourse[] = [
  {
    id: "1",
    title: "Course 1",
    description: "Continue your learning journey",
    progress: 60,
  },
  {
    id: "2",
    title: "Course 2",
    description: "Keep up the great work!",
    progress: 45,
  },
  {
    id: "3",
    title: "Course 3",
    description: "You're doing amazing!",
    progress: 80,
  },
  {
    id: "4",
    title: "Course 4",
    description: "Almost there!",
    progress: 30,
  },
];

export const mockPopularNow: LearningCourse[] = [
  {
    id: "5",
    title: "Popular Course 1",
    description: "Trending now",
  },
  {
    id: "6",
    title: "Popular Course 2",
    description: "Hot topic",
  },
  {
    id: "7",
    title: "Popular Course 3",
    description: "Must learn",
  },
  {
    id: "8",
    title: "Popular Course 4",
    description: "Top rated",
  },
];

export const mockReminders: Reminder[] = [
  {
    id: "1",
    task: "English essay",
    date: "2026. December 12. Friday",
    time: "16:00",
  },
  {
    id: "2",
    task: "English essay",
    date: "2026. December 12. Friday",
    time: "16:00",
  },
  {
    id: "3",
    task: "English essay",
    date: "2026. December 12. Friday",
    time: "16:00",
  },
];
