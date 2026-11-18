# Avant la mise en ligne

À reprendre juste avant de publier le site sur internet.

## Notifications des commandes (Telegram)

Chaque nouvelle commande envoie un message au magasin (référence, client, téléphone, adresse, recettes, total à encaisser). Le code est prêt ; il reste à le configurer.

1. Dans Telegram, écrire à **@BotFather** : `/newbot`, un nom (« Dar Slouma Commandes ») puis un identifiant qui finit par `bot`.
2. Garder le **token** donné par BotFather (c'est une clé : jamais sur GitHub).
3. Ouvrir le bot et lui envoyer un message (« سلام »).
4. Ouvrir `https://api.telegram.org/bot<TOKEN>/getUpdates` et noter `chat.id`.
5. Dans `backend/.env` (et dans les variables du serveur en production) :
   ```
   TELEGRAM_BOT_TOKEN=...
   TELEGRAM_CHAT_ID=...
   ```
6. Redémarrer le backend et passer une commande de test.

Idées pour plus tard : alerte quand une recette passe sous son seuil de stock, résumé du jour.

## Autres points

- Choisir l'hébergement et le domaine (comparatif : OVHcloud Tunisie VPS-1 + `.tn`).
- `NEXT_PUBLIC_SITE_URL` = adresse réelle du site (liens, sitemap, cartes de partage).
- Renseigner Paramètres › Boutique, Livraison (gouvernorats actifs), Objectifs, Recettes et Stock.
- Sauvegardes automatiques de la base PostgreSQL.
- Passer une commande complète de test : commande → Confirmer → En cours de livraison → Livrée.
