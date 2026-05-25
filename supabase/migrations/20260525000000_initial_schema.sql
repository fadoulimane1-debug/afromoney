-- ============================================================
-- AFROMONEY — Schéma initial Supabase
-- Migration : 20260525000000_initial_schema
--
-- Ce fichier est la SOURCE DE VÉRITÉ pour le schéma.
-- Toujours exécuter dans l'ordre (1 seule fois sur une BDD vierge).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. EXTENSION uuid (active par défaut sur Supabase)
-- ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- 0b. Trigger function updated_at (réutilisée sur toutes les tables)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────
-- 1. CLIENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE clients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom          TEXT NOT NULL,
  piece_type   TEXT NOT NULL CHECK (piece_type IN ('CIN', 'PASSPORT', 'AUTRES')),
  piece_numero TEXT NOT NULL,
  categorie    TEXT NOT NULL DEFAULT 'STANDARD'
               CHECK (categorie IN ('STANDARD', 'HABITUEL', 'AMI', 'ANONYME')),
  telephone    TEXT,
  email        TEXT,
  cree_par     TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- 2. UTILISATEURS
-- ────────────────────────────────────────────────────────────
CREATE TABLE utilisateurs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        TEXT NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('ADMIN', 'RESPONSABLE', 'CAISSIER')),
  actif      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_utilisateurs_updated_at
  BEFORE UPDATE ON utilisateurs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- 3. TRANSACTIONS
--    NB : colonnes en snake_case pour correspondre à src/types/supabase.ts
--    Les types DEPOT et RETRAIT sont inclus (absents du script initial).
-- ────────────────────────────────────────────────────────────
CREATE TABLE transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero           TEXT NOT NULL,                    -- BCH-AAAA-NNNNNN
  type             TEXT NOT NULL
                   CHECK (type IN ('ACHAT','VENTE','DEPOT','RETRAIT','CHARGES','ANNULATION')),
  devise           TEXT NOT NULL,
  montant          DECIMAL(15,4) NOT NULL,
  montant_mad      DECIMAL(15,2) NOT NULL,           -- snake_case (≠ montantMAD)
  taux             DECIMAL(12,6) NOT NULL,
  operation        TEXT NOT NULL,
  statut           TEXT NOT NULL
                   CHECK (statut IN ('PAYÉ','CRÉDIT','NON-PAYÉ')),
  moment           TEXT CHECK (moment IN ('MATIN','JOURNEE','SOIR')),
  montant_a_payer  DECIMAL(15,2),
  client_id        UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_nom       TEXT,
  cin              TEXT,
  categorie        TEXT NOT NULL DEFAULT 'STANDARD'
                   CHECK (categorie IN ('STANDARD','HABITUEL','AMI','ANONYME')),
  beneficiaire     TEXT,
  employe_id       TEXT NOT NULL,
  employe_nom      TEXT,
  note             TEXT,
  caisse_depart    DECIMAL(15,2),
  jour             SMALLINT NOT NULL CHECK (jour BETWEEN 1 AND 31),
  mois             SMALLINT NOT NULL CHECK (mois BETWEEN 1 AND 12),
  annee            SMALLINT NOT NULL,
  hash             TEXT,
  annulation_ref   UUID REFERENCES transactions(id) ON DELETE SET NULL,
  annulation_raison TEXT,
  date             DATE NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Index sur les colonnes de filtrage fréquentes
CREATE INDEX idx_transactions_date        ON transactions(date DESC);
CREATE INDEX idx_transactions_numero      ON transactions(numero);
CREATE INDEX idx_transactions_type        ON transactions(type);
CREATE INDEX idx_transactions_devise      ON transactions(devise);
CREATE INDEX idx_transactions_employe_id  ON transactions(employe_id);
CREATE INDEX idx_transactions_mois_annee  ON transactions(annee, mois);

-- ────────────────────────────────────────────────────────────
-- 4. RELIQUATS
--    versements stocké en JSONB (tableau [{id, date, montant, note}])
--    Statuts alignés sur TypeScript : NON_SOLDE / PARTIELLEMENT_SOLDE / SOLDE
-- ────────────────────────────────────────────────────────────
CREATE TABLE reliquats (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client           TEXT NOT NULL,
  categorie_client TEXT CHECK (categorie_client IN ('STANDARD','HABITUEL','AMI','ANONYME')),
  operation_ref    TEXT NOT NULL,
  operation_numero TEXT,
  devise           TEXT NOT NULL,
  montant_initial  DECIMAL(15,4) NOT NULL,
  montant_restant  DECIMAL(15,4) NOT NULL,
  statut           TEXT NOT NULL DEFAULT 'NON_SOLDE'
                   CHECK (statut IN ('NON_SOLDE','PARTIELLEMENT_SOLDE','SOLDE')),
  versements       JSONB NOT NULL DEFAULT '[]',
  note             TEXT,
  date_creation    DATE NOT NULL,
  date_maj         DATE NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_reliquats_updated_at
  BEFORE UPDATE ON reliquats
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_reliquats_statut  ON reliquats(statut);
CREATE INDEX idx_reliquats_client  ON reliquats(client);

-- ────────────────────────────────────────────────────────────
-- 5. MOUVEMENTS_CAISSE  (journal immuable — jamais UPDATE/DELETE)
--    solde_avant / solde_apres : état de la caisse avant/après le mouvement
-- ────────────────────────────────────────────────────────────
CREATE TABLE mouvements_caisse (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp        TIMESTAMPTZ NOT NULL,
  type             TEXT NOT NULL
                   CHECK (type IN ('ACHAT','VENTE','DEPOT','RETRAIT','CHARGES',
                                   'RELIQUAT','ALIMENTATION','PRELEVEMENT','ANNULATION')),
  devise           TEXT NOT NULL,
  montant          DECIMAL(15,4) NOT NULL,           -- positif=entrée, négatif=sortie
  solde_avant      DECIMAL(15,4) NOT NULL,
  solde_apres      DECIMAL(15,4) NOT NULL,
  operation_ref    TEXT,
  operation_numero TEXT,
  caissier         TEXT NOT NULL,
  note             TEXT,
  contexte         TEXT CHECK (contexte IN ('AVANT_OUVERTURE','EN_SEANCE','APRES_CLOTURE')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_mouvements_caisse_updated_at
  BEFORE UPDATE ON mouvements_caisse
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_mouvements_caisse_timestamp ON mouvements_caisse(timestamp DESC);
CREATE INDEX idx_mouvements_caisse_devise     ON mouvements_caisse(devise);

-- ────────────────────────────────────────────────────────────
-- 6. COMPTAGES_CAISSE  (physique vs théorique, ouverture / clôture)
--    lignes stockées en JSONB [{devise, montant_physique, montant_theorique, ecart}]
-- ────────────────────────────────────────────────────────────
CREATE TABLE comptages_caisse (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL,
  moment          TEXT NOT NULL CHECK (moment IN ('OUVERTURE','CLOTURE')),
  caissier        TEXT NOT NULL,
  responsable     TEXT,
  lignes          JSONB NOT NULL DEFAULT '[]',
  ecart_total_mad DECIMAL(15,2) NOT NULL DEFAULT 0,
  statut          TEXT NOT NULL DEFAULT 'BROUILLON'
                  CHECK (statut IN ('BROUILLON','VALIDÉ','LITIGE')),
  signature       TEXT,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_comptages_caisse_updated_at
  BEFORE UPDATE ON comptages_caisse
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_comptages_caisse_date ON comptages_caisse(date DESC);

-- ────────────────────────────────────────────────────────────
-- 7. RLS — Row Level Security
--    Permet à la clé anon de lire/écrire (ajuster selon les rôles)
-- ────────────────────────────────────────────────────────────
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE utilisateurs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reliquats         ENABLE ROW LEVEL SECURITY;
ALTER TABLE mouvements_caisse ENABLE ROW LEVEL SECURITY;
ALTER TABLE comptages_caisse  ENABLE ROW LEVEL SECURITY;

-- Politique permissive pour la clé anon (à restreindre en production)
CREATE POLICY "anon_all_transactions"      ON transactions      FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all_clients"           ON clients           FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all_utilisateurs"      ON utilisateurs      FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all_reliquats"         ON reliquats         FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all_mouvements_caisse" ON mouvements_caisse FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all_comptages_caisse"  ON comptages_caisse  FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
