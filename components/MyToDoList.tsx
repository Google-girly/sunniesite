import Link from "next/link";
import type { ToDoItem } from "@/lib/toDoList";

// Plain server-rendered — every item here is derived read-only data
// (see lib/toDoList.ts), nothing to click except "go there and take
// care of it," so there's no need for this to be a Client Component.
export function MyToDoList({ items }: { items: ToDoItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-stone-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        Your To-Dos
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="text-sm">
            {item.href ? (
              <Link href={item.href} className="font-medium text-rose-600 hover:text-rose-800">
                {item.label} →
              </Link>
            ) : (
              <span className="text-stone-700">{item.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
