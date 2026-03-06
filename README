# PAWS OF FURRY

**Auteur(s) :** Ninon AUTEFAGE & Yige YANG 

---

## Rappel du projet

**Description courte :**  
Jeu navigateur type endless scroll limité à 20 secondes. Le joueur doit ramasser un maximum de récompenses tout en évitant malus et ennemis.  

**Gameplay :**  
- Choix du personnage : chien ou chat.  
- Récompenses (nourriture) : augmentent le score.  
- Malus (déchets) : diminuent le score.  
- Ennemis : font perdre immédiatement la partie.  
- Mode 2 joueurs : compétitif, chacun sur son écran (hôte / invité), le but est de faire le plus de points.

---

## Lancement du jeu

**Étapes pour lancer le jeu :**  
1. Ouvrir `projet.igssystem` dans Circle et le connecter à un port libre.  
2. Ouvrir le Whiteboard et le connecter sur le port choisi dans Circle.  
3. Lancer le proxy sur `ws://localhost:8080`.  
4. Ouvrir `index.html` dans un navigateur.

### Pour l'hôte en mode multijoueur

1. Ouvrir `index.html` dans un navigateur.  
2. Choisir **Create room** dans le menu multijoueur.  
3. Récupérer son adresse IP locale :  
   - **Windows :** `ipconfig` dans le terminal  
   - **Linux / Mac :** `ifconfig` ou `ip addr` dans le terminal

### Pour l'invité en mode multijoueur

1. Ouvrir `index.html` dans un navigateur (de préférence sur un autre ordinateur connecté au même réseau local).  
2. Choisir **Join room** dans le menu multijoueur.  
3. Entrer le **ROOM CODE** visible en haut de l'écran de l'hôte.  

*Il faut parfois entrer le code une fois puis reload la page de l'invité puis remettre le code pour que les appels à l'hôte se fassent.*

---

## Architecture du jeu

3 agents :  
- **Host** : Joueur unique ou Joueur 1  
- **Joiner** : Joueur 2  
- **Whiteboard** : Gère les affichages communs (comporte quelques bugs)

---

## Fonctionnement du jeu

### Objectifs

- Obtenir le meilleur score (nourriture +10, déchet -10, attaque +50)  
- Ne pas se faire capturer (Game Over immédiat)  
- Ramasser plus de récompenses que son adversaire (pour le mode multijoueur)

### Commandes

- *Espace* : Attaque  
- *Flèches gauche et droite* : Déplacement latéral  
- *Flèche haut* : Saut (double saut autorisé)  
- *Flèche bas* : Descente rapide

---

## Remarques

- L'invité est synchronisé sur l'hôte (les éléments sont générés par l'hôte qui envoie des signaux) mais il y a parfois des décalages.  
- Nous n'avons pas pu implémenter un système de rejouabilité rapide (il faut recharger la page pour rejouer), il n'y a donc pas de sauvegarde des scores des parties précédentes.  
- Il faut parfois utiliser des impulsions manuelles pour synchroniser le whiteboard (affichage des scores).  
- Il est possible de jouer seul sans aucune connexion à Circle, mais pas en multijoueur.  
- Le programme a un comportement indéterminé si l'un des 2 joueurs se déconnecte.

