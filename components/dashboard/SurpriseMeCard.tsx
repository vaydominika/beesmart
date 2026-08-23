import { DailyCourseRecommendationCard } from "./DailyCourseRecommendationCard";

export function SurpriseMeCard() {
  return (
    <DailyCourseRecommendationCard
      kind="TRY_SOMETHING_NEW"
      title="Try something new"
      description="Let the hive choose a course for you."
      actionLabel="Surprise me"
    />
  );
}
