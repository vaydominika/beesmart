"use client";

import { useText } from "@/i18n/use-text";
import { DailyCourseRecommendationCard } from "./DailyCourseRecommendationCard";

export function SurpriseMeCard() {
  const t = useText();
  return (
    <DailyCourseRecommendationCard
      kind="TRY_SOMETHING_NEW"
      title={t("Try something new")}
      description={t("Let the hive choose a course for you.")}
      actionLabel={t("Surprise me")}
    />
  );
}
