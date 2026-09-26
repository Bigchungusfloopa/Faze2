import { unstable_cache } from "next/cache";
import { embedQuery } from "@/lib/gemini/embed";

/**
 * Caches ONLY the query embedding, not retrieval results.
 *
 * This is a narrower cache than the original design called for, and
 * deliberately so: `hybrid_search_chunks` is SECURITY INVOKER and reads
 * `auth.uid()` internally rather than taking an owner id parameter, which
 * means it must be called through the caller's cookie-scoped Supabase client
 * -- never the admin client. `unstable_cache`'s own docs are explicit that
 * cookies/headers must be read OUTSIDE a cached scope and passed in as
 * arguments, because a cached function is not guaranteed to run with the
 * current request's context. There is no way to cache a
 * cookie-client-dependent call inside `unstable_cache` without either
 * threading a real per-request client into cached scope (unsupported) or
 * changing the RPC to accept an explicit owner id callable via the admin
 * client (a real RLS-bypass surface, for a latency optimization).
 *
 * Query embedding has neither problem: it is a pure, deterministic function
 * of (model, dimension, task type, text) with no user context at all, so
 * caching it is free correctness-wise -- a hit is by definition identical to
 * a recompute. That is the one piece of "faster queries, no false
 * accuracies" this system takes on; retrieval itself runs fresh on every
 * request, which trivially satisfies "never stale" by not caching what could
 * go stale.
 */
export const cachedEmbedQuery = unstable_cache(
  async (text: string) => embedQuery(text),
  ["rag-embed-query"],
  { revalidate: 60 * 60 * 24 * 7 } // 7 days -- the model is fixed, so a hit never goes wrong
);
