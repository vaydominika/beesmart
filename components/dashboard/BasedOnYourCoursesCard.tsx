import { DailyCourseRecommendationCard } from "./DailyCourseRecommendationCard";

export function BasedOnYourCoursesCard() {
  return (
    <DailyCourseRecommendationCard
      kind="HIVE_PICK"
      title="Hive picks"
      description="Courses that match what you're already learning."
      actionLabel="See today's pick"
    />
  );
}
