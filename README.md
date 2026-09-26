# Faze

Document intelligence: upload documents, ask questions, and get answers grounded in those documents, with citations to the source file, page and section. When the documents don't answer a question, Faze says so instead of guessing.

The interface is branded **Birbal**.

## What it does

- **Many formats**: PDF (digital or scanned), images, Word, PowerPoint, Excel, CSV/TSV, text, Markdown and JSON.
- **Automatic routing and classification**: each file is classified (research paper, lecture slides, table dataset, handwritten notes, …) and sent down the pipeline that suits it. Scans and images go through Gemini vision OCR; Office and tabular files are parsed directly.
- **Hybrid retrieval**: vector search (pgvector) and keyword search combined with reciprocal rank fusion, then reranked.
- **Grounded answers**: every claim cites its source. An evidence gate refuses to answer when nothing relevant is found, and conflicting sources are shown side by side.
- **Conversations**: follow-up questions keep context; chats are saved and can be reopened with their citations.
- **Communities**: shared workspaces joined by name + password, with Admin / Editor / Viewer roles. Answers in a community come only from that community's files.

## Stack

Next.js 16 (App Router), Supabase (Postgres + pgvector, Auth, Storage), Gemini (`@google/genai`) for OCR, classification, embeddings and answers.

`doc_agent/` holds the standalone Python version of the document agent. It is not part of the deployed app, and Vercel skips it (`.vercelignore`).

## Setup

1. `npm install`
2. Create `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   SUPABASE_SECRET_KEY=
   SUPABASE_DB_URL=            # session pooler connection string, for migrations
   GEMINI_API_KEY=
   GEMINI_EMBED_MODEL=gemini-embedding-2
   GEMINI_EMBED_DIM=1536
   GEMINI_PARSE_MODEL=
   GEMINI_FAST_MODEL=
   GEMINI_ANSWER_MODEL=
   ```

3. Apply the migrations in order:

   ```
   for f in supabase/migrations/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done
   ```

4. Create a private Storage bucket named `faze-files`.
5. `npm run dev` and open http://localhost:3000.

## Deploying on Vercel

- Add the same environment variables in the Vercel project settings.
- `vercel.json` pins functions to one region; keep it the same as your Supabase project's region.
- In Supabase → Authentication → URL Configuration, set the Site URL to your domain and add `https://<your-domain>/api/auth/callback` to the redirect URLs.
