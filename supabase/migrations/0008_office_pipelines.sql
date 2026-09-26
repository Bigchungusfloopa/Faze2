-- Office formats (ported from the Python doc agent's router): each gets its
-- own pipeline label so routing is visible per document, same as PDFs.
alter type public.doc_pipeline add value if not exists 'spreadsheet';
alter type public.doc_pipeline add value if not exists 'office_doc';
alter type public.doc_pipeline add value if not exists 'presentation';
