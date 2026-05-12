import { MemberAppealPortal } from "@/components/member-appeal-portal";

export default function MemberTrackedStatusPage({
  params
}: {
  params: { trackingId: string };
}) {
  return <MemberAppealPortal trackingId={params.trackingId} view="status" />;
}
