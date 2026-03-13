import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useFriends() {
  const { data, error, isLoading, mutate } = useSWR("/api/friends", fetcher);
  return { friends: data ?? [], error, isLoading, mutate };
}

export function useFriend(id: number | null) {
  const { data, error, isLoading, mutate } = useSWR(id ? `/api/friends/${id}` : null, fetcher);
  return { friend: data, error, isLoading, mutate };
}
