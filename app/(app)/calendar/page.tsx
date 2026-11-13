import { CalendarEmbed } from "./CalendarEmbed";
import { moduleDescription } from "@/lib/modules";

export default function CalendarPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Calendar</h1>
      <p className="mt-1 text-sm text-stone-500">{moduleDescription("calendar")}</p>

      <div className="mt-6">
        <CalendarEmbed />
      </div>
    </div>
  );
}
