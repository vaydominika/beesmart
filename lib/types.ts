export type CourseCard = {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  progress?: number;
  averageRating: number | null;
};

export type ReminderItem = {
  id: string;
  task: string;
  date: string;
  time: string | null;
};

export type CurrentUser = {
  id: string;
  name: string;
  avatar: string | null;
  bannerImageUrl: string | null;
  role: string;
};

export type DashboardData = {
  continueLearning: CourseCard[];
  popularCourses: CourseCard[];
  discoverCourses: CourseCard[];
  reminders: ReminderItem[];
  streak: number;
  user: CurrentUser | null;
};
