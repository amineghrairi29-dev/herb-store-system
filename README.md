# Herb Store

Boutique en ligne et système de gestion pour une herboristerie : catalogue public, panier et commande sans compte, et un back-office complet (stock, achats, ventes, caisse, dépenses, finances, rapports).

## Fonctionnalités

**Boutique**
- Catalogue par besoins et catégories, fiche produit, panier, commande avec paiement à la réception
- Commande sans compte ; compte client optionnel (email ou Google) pour retrouver ses informations
- Contact par téléphone et WhatsApp, coordonnées gérées depuis les paramètres

**Back-office**
- Produits, catégories, classifications, images (converties en WebP)
- Stock : entrées, sorties, ajustements, pertes, retours, historique
- Fournisseurs, achats et paiements fournisseurs
- Ventes, encaissements, caisse, dépenses
- Commandes en ligne : confirmation, annulation, conversion en vente
- Tableaux de bord, rapports financiers, journal d’audit, utilisateurs

## Architecture

| Partie | Technologies |
| --- | --- |
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS |
| Backend | NestJS, TypeScript, Prisma, PostgreSQL |
| Sécurité | sessions en cookie, bcrypt, helmet, limitation de débit, contrôle d’origine |
| Déploiement | nginx, systemd, scripts de sauvegarde et restauration |

Les règles métier critiques sont aussi garanties par la base (contraintes `CHECK` : statuts de commande, montants positifs, stock cohérent).

## Démarrer en local

Prérequis : Node.js et PostgreSQL.

```bash
# Backend
cd backend
cp .env.example .env      # renseigner DATABASE_URL, AUTH_SECRET, FRONTEND_ORIGIN…
npm install
npm run start:dev         # http://localhost:3001

# Frontend (autre terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev               # http://localhost:3000
```

Tests backend : `npm test` (unitaires) et `npm run test:e2e` (base de test requise).

## Notifications de commande

Pour recevoir chaque nouvelle commande sur Telegram, renseigner `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID` dans `backend/.env` (voir `.env.example`). Sans ces variables, rien n’est envoyé.

## Documentation

Les notes de conception de chaque module sont dans [`docs/`](docs/).
