"use client";

import { useText } from "@/i18n/use-text";
import { DailyCourseRecommendationCard } from "./DailyCourseRecommendationCard";

export function BasedOnYourCoursesCard() {
  const t = useText();
  return (
    <DailyCourseRecommendationCard
      kind="HIVE_PICK"
      title={t("Hive picks")}
      description={t("Courses that match what you're already learning.")}
      actionLabel={t("See today's pick")}
    />
  );
}
