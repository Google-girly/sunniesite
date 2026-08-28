export function ModulePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">{title}</h1>
      <p className="mt-1 text-sm text-stone-500">{description}</p>

      <div className="mt-8 rounded-lg border border-dashed border-stone-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-stone-600">
          This module hasn&apos;t been built yet.
        </p>
        <p className="mt-1 text-sm text-stone-400">
          It&apos;s on the roadmap — see MODULES.md.
        </p>
      </div>
    </div>
  );
}
