import { HealthIntelWorkspace } from "@/components/healthintel-workspace";

export default function AppealDetailRoute({
  params
}: {
  params: { id: string };
}) {
  return <HealthIntelWorkspace caseId={params.id} view="case" />;
}
