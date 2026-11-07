import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@ultra/api";

export const trpc = createTRPCReact<AppRouter>();
