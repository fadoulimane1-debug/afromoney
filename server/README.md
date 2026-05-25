# AFROMONEY — Backend Express (MongoDB)

Serveur REST qui expose les données MongoDB pour le front-end Vite/React.

## Démarrage rapide

```bash
# Depuis la racine du projet :
npm run server:dev     # backend avec rechargement auto (node --watch)
npm run server         # backend sans rechargement

# Dans un autre terminal :
npm run dev            # front-end Vite
```

## Endpoints

| Méthode | Route                        | Description                       |
|---------|------------------------------|-----------------------------------|
| GET     | /api/health                  | Statut du serveur                 |
| GET     | /api/transactions            | Liste (filtres : dateDebut, dateFin, devise, type, employeId) |
| POST    | /api/transactions            | Créer une transaction             |
| PATCH   | /api/transactions/:id        | Modifier une transaction          |
| DELETE  | /api/transactions/:id        | Supprimer une transaction         |
| GET     | /api/reliquats               | Liste (filtres : statut, client)  |
| POST    | /api/reliquats               | Créer un reliquat                 |
| PATCH   | /api/reliquats/:id           | Modifier un reliquat              |
| GET     | /api/soldes                  | Soldes calculés (dateDebut, dateFin) |

## Variables d'environnement

| Variable       | Défaut                                              |
|----------------|-----------------------------------------------------|
| `PORT`         | `3001`                                              |
| `MONGODB_URI`  | `mongodb+srv://afromoney:...`                       |
| `DB_NAME`      | `afromoney_db`                                      |

## Architecture

```
[React/Vite browser]  →  fetch() mongoApiClient.ts
        ↓
[Express server/index.js : port 3001]
        ↓
[MongoDB Atlas : afromoney_db]
```
