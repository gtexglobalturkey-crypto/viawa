import { AIContextCard } from "../../components/today/AIContextCard";
import { DraftEmailsCard } from "../../components/today/DraftEmailsCard";
import { NextActionsCard } from "../../components/today/NextActionsCard";
import { RiskSignalsCard } from "../../components/today/RiskSignalsCard";
import { PageHeader } from "../../components/ui/PageHeader";

import { useTodayData } from "../../hooks/useTodayData";
import { useTodayWorkflow } from "../../hooks/useTodayWorkflow";

import { CurrentTaskCard } from "./CurrentTaskCard";

export function TodayPage() {
  const today = useTodayData();

  const workflow = useTodayWorkflow(
    today.workflow,
    today.reload,
  );

  return (
    <main className="page today-page">
      <section className="today-heading-row">
        <PageHeader
          eyebrow="Bugün"
          title="Günlük Özet"
          subtitle="Önce e-postalarla başlayın, ardından aramaları ve takipleri tamamlayın."
        />

        <div className="today-current-task">
          <CurrentTaskCard
            task={
              workflow.currentTask
            }
            atlasRecommendedTask={
              workflow.atlasRecommendedTask
            }
            queue={workflow.queue}
            completing={
              workflow.completing
            }
            isUsingCustomTask={
              workflow.isUsingCustomTask
            }
            onStart={
              workflow.startTask
            }
            onComplete={
              workflow.completeTask
            }
            onSelectTask={
              workflow.selectTask
            }
            onResetToRecommendation={
              workflow.resetToRecommendation
            }
          />
        </div>
      </section>

      <section className="today-grid">
        <NextActionsCard
          data={today}
        />

        <AIContextCard
          data={today}
        />

        <RiskSignalsCard
          data={today}
        />

        <DraftEmailsCard
          data={today}
        />
      </section>
    </main>
  );
}