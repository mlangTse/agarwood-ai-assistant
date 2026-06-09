-- Keep only the newest knowledge document for each source/title pair.
-- embeddings are removed automatically through the on delete cascade constraint.
with ranked as (
  select
    id,
    row_number() over (
      partition by coalesce(source_name, title), title
      order by created_at desc, id desc
    ) as duplicate_rank
  from knowledge_documents
)
delete from knowledge_documents
where id in (
  select id
  from ranked
  where duplicate_rank > 1
);
