"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";

function timeAgo(date: string | Date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsPage() {
  const utils = trpc.useUtils();
  // MVP review — was hard-capped at 50 with no way to page further back.
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.notifications.list.useInfiniteQuery({}, { getNextPageParam: (lastPage) => lastPage.nextCursor });
  const notifications = data?.pages.flatMap((p) => p.items);
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => utils.notifications.list.invalidate() });
  const markAllRead = trpc.notifications.markAllRead.useMutation({ onSuccess: () => utils.notifications.list.invalidate() });
  const { data: preferences } = trpc.notifications.preferences.useQuery();
  const updatePreferences = trpc.notifications.updatePreferences.useMutation({ onSuccess: () => utils.notifications.preferences.invalidate() });

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">Notifications</h1>
        <button onClick={() => markAllRead.mutate()} className="text-xs font-semibold text-emerald-800">
          Mark all read
        </button>
      </div>

      <section className="mb-6 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-stone-900">Notification preferences</h2>
        <label className="mt-3 flex items-center justify-between gap-3 text-sm text-stone-700">
          <span>Push notifications</span>
          <input type="checkbox" checked={preferences?.push ?? true} disabled={!preferences || updatePreferences.isPending} onChange={(event) => updatePreferences.mutate({ push: event.target.checked })} />
        </label>
        <p className="mt-2 text-xs text-stone-500">In-app notification history is always retained. Email, SMS and WhatsApp delivery will appear here when those channels are configured.</p>
      </section>
      {isLoading && <div className="text-sm text-stone-500">Loading\u2026</div>}
      {error && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
          {error.message === "Sign in required." ? "Sign in to see your notifications." : error.message}
        </div>
      )}
      {notifications?.length === 0 && <div className="text-sm text-stone-500">Nothing yet.</div>}

      <div className="space-y-2">
        {notifications?.map((n) => (
          <article key={n.id} className={`border rounded-xl p-4 flex justify-between items-start gap-3 ${n.readAt ? "border-stone-200 bg-white" : "border-emerald-300 bg-white"}`}>
            <div>
              <div className="text-sm font-semibold text-stone-900">{n.title}</div>
              <div className="text-xs text-stone-500 mt-1">{n.body}</div>
              {n.type === "SAVED_SEARCH_MATCH" && n.data && typeof n.data === "object" && "listingId" in n.data && typeof n.data.listingId === "string" && (
                <Link href={`/listings/${n.data.listingId}`} onClick={() => !n.readAt && markRead.mutate({ id: n.id })} className="inline-block text-xs font-semibold text-emerald-800 underline mt-2">View property</Link>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] font-mono text-stone-500">{timeAgo(n.createdAt)}</span>
              {!n.readAt && <button onClick={() => markRead.mutate({ id: n.id })} className="text-[10px] font-semibold text-emerald-800 underline">Mark read</button>}
            </div>
          </article>
        ))}
      </div>

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full mt-4 border border-stone-300 text-stone-700 text-sm font-semibold rounded-lg py-2.5 disabled:opacity-50"
        >
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </main>
  );
}
