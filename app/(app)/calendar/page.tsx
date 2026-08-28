import { CalendarEmbed } from "./CalendarEmbed";

export default function CalendarPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Calendar</h1>

      <div className="mt-6">
        <CalendarEmbed />
      </div>
    </div>
  );
}
