export type CourseCard = {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  progress?: number;
  averageRating: number | null;
};

export type CurrentUser = {
  id: string;
  name: string;
  avatar: string | null;
  bannerImageUrl: string | null;
};

export type DashboardData = {
  continueLearning: CourseCard[];
  popularCourses: CourseCard[];
  discoverCourses: CourseCard[];
  myCourses: CourseCard[];
  finishedCourses: CourseCard[];
  streak: number;
  activeTicketCount: number;
  user: CurrentUser | null;
};
