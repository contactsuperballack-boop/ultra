import { trpc } from "./trpc";

/**
 * Optimistic save/unsave — updates the local savedIds cache immediately on
 * tap, rather than waiting for the round trip. Previously flagged: on a
 * poor connection, waiting for the server response before the heart icon
 * changed felt slow/unresponsive. Rolls back to the previous cache state
 * if the mutation actually fails (e.g. signed out — see the onError
 * handling here, which surfaces that case specifically rather than
 * failing silently).
 */
export function useSaveToggle(onAuthRequired?: () => void) {
  const utils = trpc.useUtils();

  const toggle = trpc.savedListings.toggle.useMutation({
    onMutate: async ({ listingId }) => {
      await utils.savedListings.ids.cancel();
      const previous = utils.savedListings.ids.getData();
      utils.savedListings.ids.setData(undefined, (old) => {
        const current = old ?? [];
        return current.includes(listingId) ? current.filter((id) => id !== listingId) : [...current, listingId];
      });
      return { previous };
    },
    onError: (err, _vars, context) => {
      // Roll back to the pre-tap state — this is also where a signed-out
      // toggle used to fail silently (the heart flipped back with no
      // explanation). Now it surfaces a clear prompt instead.
      utils.savedListings.ids.setData(undefined, context?.previous);
      const code = (err as { data?: { code?: string } })?.data?.code;
      if (code === "UNAUTHORIZED" && onAuthRequired) onAuthRequired();
    },
    onSettled: () => {
      utils.savedListings.ids.invalidate();
      utils.savedListings.list.invalidate();
    },
  });

  return toggle;
}
