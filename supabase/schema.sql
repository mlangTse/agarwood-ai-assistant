create extension if not exists "uuid-ossp";
create extension if not exists vector;

create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid unique,
  display_name text,
  phone text,
  role text not null default 'visitor' check (role in ('visitor', 'admin', 'curator', 'sales')),
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete set null,
  module text not null check (module in ('mentor', 'encyclopedia', 'shopping')),
  title text,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.incense_regions (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  country text,
  aroma_character text not null,
  typical_scenes text[] not null default '{}',
  risk_notes text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.scent_tags (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.aroma_profiles (
  id uuid primary key default uuid_generate_v4(),
  sweetness int not null default 50 check (sweetness between 0 and 100),
  coolness int not null default 50 check (coolness between 0 and 100),
  creaminess int not null default 50 check (creaminess between 0 and 100),
  medicinal int not null default 50 check (medicinal between 0 and 100),
  woody int not null default 50 check (woody between 0 and 100),
  penetration int not null default 50 check (penetration between 0 and 100),
  longevity int not null default 50 check (longevity between 0 and 100),
  beginner_friendly int not null default 50 check (beginner_friendly between 0 and 100),
  collection_value int not null default 50 check (collection_value between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  product_type text not null check (product_type in ('wood', 'bracelet', 'powder', 'incense', 'object', 'investment')),
  region text not null,
  region_id uuid references public.incense_regions(id) on delete set null,
  price_cents int not null default 0,
  budget_level text not null check (budget_level in ('500', '3000', '20000', 'collector')),
  description text not null default '',
  risk_notes text[] not null default '{}',
  suitable_for text[] not null default '{}',
  scent_tags text[] not null default '{}',
  aroma_profile_id uuid references public.aroma_profiles(id) on delete set null,
  aroma_scores jsonb not null default '{}'::jsonb,
  inventory_status text not null default 'in_stock' check (inventory_status in ('in_stock', 'limited', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_documents (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  source_name text,
  mime_type text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.embeddings (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists embeddings_embedding_idx
  on public.embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists embeddings_document_id_idx on public.embeddings(document_id);
create index if not exists products_budget_level_idx on public.products(budget_level);
create index if not exists products_product_type_idx on public.products(product_type);

create table if not exists public.recommendations (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references public.conversations(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  score numeric(5,2),
  reason text,
  risk_notes text,
  is_favorite boolean not null default false,
  user_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  scenes text[] not null default '{}',
  scent_tags text[] not null default '{}',
  budget_level text check (budget_level in ('500', '3000', '20000', 'collector')),
  desired_scores jsonb not null default '{}'::jsonb,
  product_types text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count int default 5,
  similarity_threshold float default 0.2
)
returns table (
  id uuid,
  document_id uuid,
  title text,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    e.id,
    e.document_id,
    d.title,
    e.content,
    e.metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.embeddings e
  join public.knowledge_documents d on d.id = e.document_id
  where 1 - (e.embedding <=> query_embedding) > similarity_threshold
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

alter table public.users enable row level security;
alter table public.conversations enable row level security;
alter table public.products enable row level security;
alter table public.aroma_profiles enable row level security;
alter table public.scent_tags enable row level security;
alter table public.incense_regions enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.embeddings enable row level security;
alter table public.recommendations enable row level security;
alter table public.user_preferences enable row level security;

create policy "public read products" on public.products for select using (true);
create policy "public read regions" on public.incense_regions for select using (true);
create policy "public read scent tags" on public.scent_tags for select using (true);

insert into public.incense_regions (name, country, aroma_character, typical_scenes)
values
  ('惠安系', '越南', '甜润、花蜜、清透，适合低温细闻。', array['茶室', '静坐', '夜读']),
  ('星洲系', '印尼/马来西亚', '木质、凉感、穿透力较强，空间表现直接。', array['商务空间', '办公室', '展厅']),
  ('海南', '中国', '雅正温润，文化叙事强，适合文博展陈。', array['文博馆', '雅集', '礼赠'])
on conflict (name) do nothing;
