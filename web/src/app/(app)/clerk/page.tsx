import ScreenPlaceholder from "@/components/ScreenPlaceholder";

export default function ClerkPage() {
  return (
    <ScreenPlaceholder
      title="予約受付"
      url="/clerk"
      role="staff / admin"
      description="当日の予約受付・来店確認。"
      apis={["GET /reservations（当日）"]}
    />
  );
}
