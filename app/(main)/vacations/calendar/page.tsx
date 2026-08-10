import { LeaveCalendar } from "@/components/vacations/leave-calendar"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Календарь отпусков",
}

export default function VacationsCalendarPage() {
  return <LeaveCalendar />
}
