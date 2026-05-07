# Guard — Trading Journal

Application de journal de trading, entièrement côté client (HTML / CSS / JS).

## Fonctionnalités

- Saisie et suivi des trades (long / short, setup, confluences, émotions)
- Dashboard de statistiques et graphiques (Chart.js)
- Historique filtrable et triable
- Système de grading et score de qualité
- Persistance locale via `localStorage`

## Lancer le projet

Aucune dépendance à installer. Ouvrir `index.html` dans un navigateur.

```bash
open index.html
```

## Structure actuelle

```
journal-trade/
└── index.html   # Application complète (HTML + CSS + JS)
```

## Stack

- HTML / CSS / JS vanilla
- [Chart.js 4.4.1](https://www.chartjs.org/) via CDN
- Stockage : `localStorage`
