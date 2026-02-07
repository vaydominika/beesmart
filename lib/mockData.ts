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

export const mockDiscoverNow: LearningCourse[] = [
  {
    id: "9",
    title: "Discover Course 1",
    description: "Explore something new",
  },
  {
    id: "10",
    title: "Discover Course 2",
    description: "Expand your skills",
  },
  {
    id: "11",
    title: "Discover Course 3",
    description: "Try a new topic",
  },
  {
    id: "12",
    title: "Discover Course 4",
    description: "Recommended for you",
  },
  {
    id: "13",
    title: "Discover Course 5",
    description: "Level up your knowledge",
  },
  {
    id: "14",
    title: "Discover Course 6",
    description: "Fresh picks this week",
  },
  {
    id: "15",
    title: "Discover Course 7",
    description: "Based on your interests",
  },
  {
    id: "16",
    title: "Discover Course 8",
    description: "Start your next adventure",
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
];
