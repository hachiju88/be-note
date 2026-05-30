/**
 * 画面雛形の共通プレースホルダ。
 * 画面名・URL・権限・主な API を表示するだけ。ロジックは実装フェーズで追加する。
 */
type Props = {
  title: string;
  url: string;
  role: string;
  apis?: string[];
  description?: string;
};

export default function ScreenPlaceholder({
  title,
  url,
  role,
  apis = [],
  description,
}: Props) {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <p className="font-mono text-sm text-gray-500">{url}</p>
      <h1 className="mt-1 text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-gray-600">権限: {role}</p>
      {description && <p className="mt-4 text-gray-700">{description}</p>}
      {apis.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-700">主な API</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-600">
            {apis.map((a) => (
              <li key={a}>
                <code>{a}</code>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-8 text-xs text-gray-400">
        ※ 雛形（プレースホルダ）。ロジックは未実装。仕様は docs/ を参照。
      </p>
    </main>
  );
}
