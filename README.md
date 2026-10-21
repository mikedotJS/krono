# Krono

Chrono de boxe pour coachs, en application web installable (PWA), sans aucune dépendance ni étape de build.

En ligne : https://mikedotjs.github.io/krono/

## Fonctions

- Séances composées de blocs enchaînés (rounds, durée du round, repos), avec préparation et signal avant la fin.
- Écran de séance à contraste maximal : toucher pour mettre en pause, glisser vers la gauche pour passer à la phase suivante.
- Historique des séances, relance en un geste.
- Sons synthétisés (cloche, gong, bip, claquettes), écran maintenu allumé quand le navigateur le permet.
- Fonctionne hors ligne une fois installée. Toutes les données restent sur l'appareil (localStorage) et se réinitialisent depuis Réglages.

## Installer sur iPhone

Ouvrir le lien dans Safari, puis Partager › Sur l'écran d'accueil.

Limite propre aux PWA sur iOS : quand l'écran se verrouille ou qu'on change d'app, la page est suspendue et les signaux ne sonnent pas. Le temps continue d'être compté et la séance reprend au bon endroit au retour.

## Développement

```
npm run serve   # http://localhost:8080
npm test        # tests du moteur de séance (node --test)
```

À chaque mise en ligne, incrémenter `VERSION` dans `sw.js` pour que les appareils récupèrent la nouvelle version.
