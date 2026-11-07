import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const notificationsRouter = router({
  list: protectedProcedure
    .input(z.object({ cursor: z.string().nullish(), limit: z.number().min(1).max(50).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const items = await ctx.db.notification.findMany({
        where: { userId: ctx.userId! },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(input?.cursor && { cursor: { id: input.cursor }, skip: 1 }),
      });
      let nextCursor: string | undefined;
      if (items.length > limit) nextCursor = items.pop()!.id;
      return { items, nextCursor };
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.notification.count({ where: { userId: ctx.userId!, readAt: null } });
  }),

  markRead: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.notification.updateMany({
      where: { id: input.id, userId: ctx.userId! }, // scoped to the caller — can't mark someone else's notification read
      data: { readAt: new Date() },
    });
  }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    return ctx.db.notification.updateMany({
      where: { userId: ctx.userId!, readAt: null },
      data: { readAt: new Date() },
    });
  }),

  registerPushToken: protectedProcedure.input(z.object({ token: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db.user.update({ where: { id: ctx.userId! }, data: { pushToken: input.token } });
    return { success: true };
  }),

  // Closes the shared-device edge case flagged in review: Expo push tokens
  // are tied to a physical device, not a session — without this, a push
  // meant for the first user could still arrive after a second user signs
  // in on the same phone. Called on sign-out (see ProfileScreen), before
  // the local session itself is cleared.
  deregisterPushToken: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.user.update({ where: { id: ctx.userId! }, data: { pushToken: null } });
    return { success: true };
  }),
});
