import { Type, type Schema } from "@google/genai";
import { generateJson } from "@/lib/gemini/json";
import { GEMINI_FAST_MODEL } from "@/lib/gemini/models";

export type QueryIntent = "lookup" | "compare" | "synthesis" | "chitchat";

export interface RewriteResult {
  standaloneQuery: string;
  subQueries: string[];
  intent: QueryIntent;
  needsRetrieval: boolean;
}

interface RawRewrite {
  standalone_query: string;
  sub_queries: string[];
  intent: string;
  needs_retrieval: boolean;
}

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ["standalone_query", "sub_queries", "intent", "needs_retrieval"],
  properties: {
    standalone_query: {
      type: Type.STRING,
      description: "The user's latest message rewritten to need no conversation history to interpret.",
    },
    sub_queries: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "1-4 independent search queries. If the question needs facts that live in different places " +
        "(a comparison, a synthesis of several sources), decompose into 2-4. Otherwise return exactly one, " +
        "equal to standalone_query.",
    },
    intent: {
      type: Type.STRING,
      enum: ["lookup", "compare", "synthesis", "chitchat"],
      format: "enum",
      description:
        "lookup = a specific fact. compare = contrasting 2+ sources. synthesis = combining several passages. " +
        "chitchat = no retrieval needed at all (greetings, thanks, meta-questions about the conversation itself).",
    },
    needs_retrieval: { type: Type.BOOLEAN },
  },
};

const NO_HISTORY_INTENT_ONLY: Schema = {
  type: Type.OBJECT,
  required: ["sub_queries", "intent", "needs_retrieval"],
  properties: {
    sub_queries: { type: Type.ARRAY, items: { type: Type.STRING } },
    intent: { type: Type.STRING, enum: ["lookup", "compare", "synthesis", "chitchat"], format: "enum" },
    needs_retrieval: { type: Type.BOOLEAN },
  },
};

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Rewrites the user's latest message into a standalone query, decomposing it
 * into sub-queries when the answer needs facts from different places. Only
 * called when there is prior history -- a first turn needs no rewriting, and
 * skipping the call there is a real cost saving, not just a convenience.
 */
export async function rewriteQuery(message: string, history: HistoryTurn[]): Promise<RewriteResult> {
  if (history.length === 0) {
    const raw = await generateJson<Omit<RawRewrite, "standalone_query">>(
      GEMINI_FAST_MODEL,
      `Decide how to search for an answer to this message:\n\n"${message}"\n\n` +
        `If it needs facts from different places (a comparison, a synthesis of several sources), ` +
        `decompose into 2-4 independent search queries. Otherwise return exactly one, equal to the message ` +
        `itself. If this is a greeting, thanks, or a meta-question about the conversation with no factual ` +
        `content to look up, set needs_retrieval to false.`,
      NO_HISTORY_INTENT_ONLY
    );
    return {
      standaloneQuery: message,
      subQueries: raw.sub_queries.length > 0 ? raw.sub_queries : [message],
      intent: normalizeIntent(raw.intent),
      needsRetrieval: raw.needs_retrieval,
    };
  }

  const historyText = history
    .slice(-6)
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content.slice(0, 300)}`)
    .join("\n");

  const prompt = `Conversation so far:
${historyText}

User's latest message: "${message}"

Rewrite the latest message as a standalone search query that needs no
conversation history to interpret -- resolve every pronoun and elliptical
reference against the history above.

If answering it requires facts that live in different places, decompose it
into 2-4 independent sub-queries. Otherwise return exactly one, equal to the
standalone query.

If the latest message is a greeting, thanks, or purely about the conversation
itself (e.g. "can you rephrase that") with nothing new to look up, set
needs_retrieval to false.`;

  const raw = await generateJson<RawRewrite>(GEMINI_FAST_MODEL, prompt, RESPONSE_SCHEMA);

  return {
    standaloneQuery: raw.standalone_query || message,
    subQueries: raw.sub_queries.length > 0 ? raw.sub_queries : [raw.standalone_query || message],
    intent: normalizeIntent(raw.intent),
    needsRetrieval: raw.needs_retrieval,
  };
}

function normalizeIntent(intent: string): QueryIntent {
  return (["lookup", "compare", "synthesis", "chitchat"].includes(intent) ? intent : "lookup") as QueryIntent;
}
