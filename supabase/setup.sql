-- ============================================================================
-- setup.sql — Pega y ejecuta todo este archivo en Supabase → SQL Editor
-- ============================================================================

-- 1) Tabla de grupos (tu lista de invitados)
create table grupos (
  id bigint generated always as identity primary key,
  grupo text not null unique,
  miembros jsonb not null,
  estado text not null default 'pendiente',
  decision text
);

-- 2) Tabla de respuestas (el detalle de cada persona que confirma)
create table respuestas (
  id bigint generated always as identity primary key,
  grupo text not null,
  decision text not null,
  tipo text,
  nombre text,
  celular text,
  correo text,
  sabor text,
  creado_en timestamptz not null default now()
);

-- 3) Seguridad: cualquiera puede leer la lista de grupos (para el buscador),
--    pero solo puede actualizar un grupo mientras siga "pendiente" —
--    esto es lo que evita el doble registro.
alter table grupos enable row level security;

create policy "lectura publica de grupos"
  on grupos for select
  using (true);

create policy "marcar respondido solo si estaba pendiente"
  on grupos for update
  using (estado = 'pendiente');

-- 4) Seguridad: cualquiera puede insertar una respuesta, pero NADIE puede
--    leer las respuestas desde el navegador (solo tú, desde el panel de Supabase).
alter table respuestas enable row level security;

create policy "insertar respuestas"
  on respuestas for insert
  with check (true);

-- 5) Datos: tu lista real de invitados (generada desde tu Excel)
insert into grupos (grupo, miembros) values
  ('Familia Cabiativa Romero', '["Karen Romero", "Abril Mesa", "Nicolas Cabiativa"]'::jsonb),
  ('Familia Smith Romero', '["Constanza Romero", "Brian Smith"]'::jsonb),
  ('Otilia Hernandez', '["Otilia Hernandez"]'::jsonb),
  ('Isabella Romero', '["Isabella Romero"]'::jsonb),
  ('Familia Rodriguez Hernandez', '["Juliana Hernandez", "Cristian Rodriguez"]'::jsonb),
  ('Familia Rojas Coy', '["Ximena Coy", "Daniel Rojas"]'::jsonb),
  ('Familia Doncel Roman', '["Valentina Doncel", "Fernanda Roman"]'::jsonb),
  ('Ana Hernandez', '["Ana Hernandez"]'::jsonb),
  ('Santiago Hernandez', '["Santiago Hernandez"]'::jsonb),
  ('Diego Hernandez', '["Diego Hernandez"]'::jsonb),
  ('Paola Hernandez', '["Paola Hernandez", "Acompañante", "Mariana Hernandez"]'::jsonb),
  ('Familia Gordo Hernandez', '["Melba Hernandez", "Leonidas Gordo"]'::jsonb),
  ('Otilia Neira', '["Otilia Neira"]'::jsonb),
  ('Juan Carlos Romero', '["Juan Carlos Romero"]'::jsonb),
  ('Familia Rojas Hernandez', '["Gabriela Rojas", "Fernanda Hernandez", "Pedro Rojas"]'::jsonb),
  ('Familia Romero Cortes', '["Ricardo Romero", "Katty Cortes"]'::jsonb),
  ('Daniela Gonzalez', '["Daniela Gonzalez"]'::jsonb),
  ('Tatiana Acero', '["Tatiana Acero"]'::jsonb),
  ('Laura Rojas', '["Laura Rojas"]'::jsonb),
  ('Laura Baron', '["Laura Baron", "Andres Baron", "Erika Corredor", "Acompañante"]'::jsonb),
  ('Veronica Navas', '["Veronica Navas"]'::jsonb),
  ('Juanita Bocachica y Acompañante', '["Juanita Bocachica", "Acompañante"]'::jsonb),
  ('Familia Marles Barrera', '["Aura Barrera", "Ruben Marles"]'::jsonb),
  ('Familia Contreras Rodriguez', '["Catherine Rodriguez", "Carlos Contreras", "Ana Maria Contreras", "Alison Contreras"]'::jsonb),
  ('Pitty Barrera', '["Pitty Barrera", "Isabella Villareal", "Jose Villareal", "Nestor Villareal", "Patricia Barrera"]'::jsonb),
  ('Nicolle Sarria', '["Nicolle Sarria"]'::jsonb),
  ('Carlos Burgos', '["Carlos Burgos"]'::jsonb),
  ('Juan Pablo Sanchez', '["Juan Pablo Sanchez"]'::jsonb),
  ('Raul Barrera', '["Raul Barrera"]'::jsonb),
  ('Matha Barrera', '["Martha Barrera"]'::jsonb),
  ('Jesus Rodriguez', '["Jesus Rodriguez"]'::jsonb),
  ('Harby Barrera', '["Harby Barrera", "Gabriel Barrera"]'::jsonb),
  ('Caliche y Mari', '["Carlos Romero", "Mari"]'::jsonb),
  ('Rafael y Consuelo', '["Rafael Barrera", "Consuelo"]'::jsonb),
  ('Albaluz Marles', '["Albaluz Marles", "Diana Silva", "Cristian", "Bebe"]'::jsonb),
  ('Alejandro Rodriguez', '["Alejandro Rodriguez"]'::jsonb);
