const dayAndMonth = new Intl.DateTimeFormat("es", { day: "numeric", month: "long" });
const fullDate = new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric" });

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const DAY = 24 * 60 * 60 * 1000;

/** When a project was last opened, as a writer would say it: hoy, ayer, 12 de marzo. */
export function lastOpened(when: string, now: Date = new Date()): string {
  const date = new Date(when);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  return date.getFullYear() === now.getFullYear()
    ? dayAndMonth.format(date)
    : fullDate.format(date);
}
