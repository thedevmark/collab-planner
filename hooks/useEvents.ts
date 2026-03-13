import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useEvents(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();

  const { data, error, isLoading, mutate } = useSWR(
    `/api/events${query ? `?${query}` : ""}`,
    fetcher
  );
  return { events: data ?? [], error, isLoading, mutate };
}

export function useEvent(id: number | null) {
  const { data, error, isLoading, mutate } = useSWR(id ? `/api/events/${id}` : null, fetcher);
  return { event: data, error, isLoading, mutate };
}
