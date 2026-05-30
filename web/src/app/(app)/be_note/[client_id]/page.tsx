import ScreenPlaceholder from "@/components/ScreenPlaceholder";

export default async function BeNotePage({
  params,
}: PageProps<"/be_note/[client_id]">) {
  const { client_id } = await params;

  return (
    <ScreenPlaceholder
      title="Be:note"
      url={`/be_note/${client_id}`}
      role="staff / admin / customer（自分のみ）"
      description="顧客カルテ兼交換ノート。note 一覧（木構造）・DM・未来予約参照。"
      apis={[
        "GET /clients/{client_id}/notes",
        "POST /clients/{client_id}/notes",
      ]}
    />
  );
}
