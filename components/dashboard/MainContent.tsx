import { LearningCard } from "./LearningCard";
import { mockContinueLearning, mockPopularNow } from "@/lib/mockData";

export function MainContent() {
  return (
    <div className="flex-1 p-6 space-y-8 overflow-y-auto bg-(--theme-bg)">
      <section>
        <h2 className="text-[40px] font-bold uppercase tracking-tight text-(--theme-text) mb-4">
          CONTINUE LEARNING
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mockContinueLearning.map((course) => (
            <LearningCard
              key={course.id}
              title={course.title}
              description={course.description}
              progress={course.progress}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[40px] font-bold uppercase tracking-tight text-(--theme-text) mb-4">
          POPULAR NOW
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mockPopularNow.map((course) => (
            <LearningCard
              key={course.id}
              title={course.title}
              description={course.description}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
