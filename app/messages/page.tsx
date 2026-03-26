import { redirect } from "next/navigation";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string }>;
}) {
  const { eventId } = await searchParams;

  if (eventId) {
    redirect(`/events/${eventId}`);
  }

  redirect("/events/new");
}
