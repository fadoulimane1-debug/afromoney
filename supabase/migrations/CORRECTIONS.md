# Corrections par rapport au SQL initial (Prompt 9)

Ce document explique pourquoi le schéma final diffère du SQL fourni,
pour que les deux restent cohérents avec `src/types/supabase.ts`.

## Table `transactions`

| SQL fourni | Schéma corrigé | Raison |
|---|---|---|
| `montantMAD` | `montant_mad` | snake_case obligatoire (convention Supabase + TypeScript) |
| `client TEXT` | `client_id UUID` + `client_nom TEXT` | Référence vers la table `clients` |
| Types : `ACHAT, VENTE, CHARGES, ANNULATION` | + `DEPOT, RETRAIT` | Présents dans `TransactionType` TypeScript |
| `date TIMESTAMP` | `date DATE` | La date de transaction est une date (sans heure) |
| Manquant | `operation, statut, moment, montant_a_payer, categorie, beneficiaire, employe_id, employe_nom, note, caisse_depart, jour, mois, annee, hash, annulation_ref, annulation_raison` | Champs requis par les composants existants |

## Table `reliquats`

| SQL fourni | Schéma corrigé | Raison |
|---|---|---|
| `origine_operation REFERENCES transactions(numero)` | `operation_ref TEXT` + `operation_numero TEXT` | La référence peut être un ID ou un numéro libre |
| `devise_du`, `montant_du` | `devise`, `montant_initial`, `montant_restant` | Aligné sur le type `ReliquatDB` |
| Statuts : `EN_ATTENTE, PARTIELLEMENT_SOLDE, SOLDE` | `NON_SOLDE, PARTIELLEMENT_SOLDE, SOLDE` | Aligné sur `StatutReliquat` TypeScript |
| Manquant | `versements JSONB`, `categorie_client`, `note`, `date_creation`, `date_maj` | Requis par la page Reliquats |

## Table `mouvements_caisse`

| SQL fourni | Schéma corrigé | Raison |
|---|---|---|
| Types : `ALIMENTATION, PRELEVEMENT, SOLDAGE_RELIQUAT` | `ACHAT, VENTE, DEPOT, RETRAIT, CHARGES, RELIQUAT, ALIMENTATION, PRELEVEMENT, ANNULATION` | Aligné sur `MouvementTypeDB` TypeScript |
| Manquant | `timestamp, solde_avant, solde_apres, operation_ref, operation_numero, caissier` | Journal d'audit append-only |
| `date TIMESTAMP` | `timestamp TIMESTAMPTZ` | Horodatage complet (ISO 8601) |

## Nouvelles tables (absentes du prompt)

| Table | Raison |
|---|---|
| `clients` | Requis par la page Clients et `client_id` dans transactions |
| `comptages_caisse` | Requis par `ComptageCaisse` TypeScript et la page Réconciliation |

## RLS ajouté

Les politiques RLS permettent à la clé `anon` de tout lire/écrire.
**En production**, remplacer par des politiques par rôle :
- `CAISSIER` : INSERT transactions, SELECT clients
- `RESPONSABLE` : + UPDATE reliquats, SELECT mouvements_caisse
- `ADMIN` : accès complet
