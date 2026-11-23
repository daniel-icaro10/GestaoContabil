-- Estrutura inicial do banco (PostgreSQL).
-- Datas/horas em TIMESTAMPTZ (UTC); valores monetários em centavos (inteiro).
-- Campos JSON ficam em TEXT porque a aplicação grava e lê o JSON diretamente.

CREATE TABLE users (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name               TEXT NOT NULL,
  email              TEXT NOT NULL UNIQUE,
  password_hash      TEXT NOT NULL,
  role               TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  active             INTEGER NOT NULL DEFAULT 1,
  permissions        TEXT NOT NULL DEFAULT '[]',
  document           TEXT,
  phone              TEXT,
  tax_config         TEXT,
  current_company_id INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE companies (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_companies_user ON companies(user_id);

ALTER TABLE users
  ADD CONSTRAINT users_current_company_fk
  FOREIGN KEY (current_company_id) REFERENCES companies(id) ON DELETE SET NULL;

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE plans (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  price_cents     INTEGER NOT NULL,
  interval_months INTEGER NOT NULL DEFAULT 1,
  active          INTEGER NOT NULL DEFAULT 1,
  modules         TEXT, -- módulos liberados pelo plano (JSON); NULL = todos
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id            INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan_id            INTEGER NOT NULL REFERENCES plans(id),
  status             TEXT NOT NULL DEFAULT 'pending',
  current_period_end TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan_id         INTEGER REFERENCES plans(id),
  cora_id         TEXT UNIQUE,
  code            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'OPEN',
  amount_cents    INTEGER NOT NULL,
  period_months   INTEGER NOT NULL DEFAULT 1,
  due_date        DATE NOT NULL,
  boleto_url      TEXT,
  digitable       TEXT,
  barcode         TEXT,
  pix_emv         TEXT,
  paid_at         TIMESTAMPTZ,
  applied         INTEGER NOT NULL DEFAULT 0,
  manual          INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_user ON invoices(user_id);
CREATE INDEX idx_invoices_status ON invoices(status);

CREATE TABLE webhook_events (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id    TEXT,
  event_type  TEXT,
  resource_id TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
