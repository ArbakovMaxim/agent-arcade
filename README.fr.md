<img src="docs/brand/arcade-logo-2-512.png" width="96" alt="Logo d’Arcade" align="right">

# Arcade — jouez, lisez, écoutez et regardez pendant que votre agent Claude Code travaille

[English](README.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [Español](README.es.md) · **Français** · [Deutsch](README.de.md) · [Português](README.pt.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [日本語](README.ja.md) · [中文](README.zh.md) · [한국어](README.ko.md)

> **Alpha (0.26).** Arcade fonctionne et sert tous les jours, mais c’est une version précoce : des choses peuvent casser, et les paramètres ou le catalogue peuvent changer d’une mise à jour à l’autre. Les signalements de bugs sont les bienvenus — voir [Retours](#retours).

Arcade est un plugin pour [Claude Code](https://claude.com/claude-code) qui occupe l’attente pendant que votre agent travaille. Quand l’agent est occupé depuis plus de 10 secondes, un petit *« envie de jouer ? »* apparaît au-dessus du prompt. Lancez un jeu — NES, Sega, PlayStation, Doom, échecs et plus encore —, lisez un livre, écoutez un livre audio ou un podcast, ou regardez une vidéo sur le sujet du travail de l’agent. Arcade vous prévient dès que l’agent a fini ou a besoin de votre autorisation : vous ne manquez rien.

Tout le catalogue est gratuit : les jeux sont sous licences libres, les livres et livres audio sont dans le domaine public. Vous pouvez aussi jouer en ligne avec d’autres personnes qui attendent leur agent, et discuter avec vos amis.

![« envie de jouer ? » au-dessus du prompt de Claude Code après 11 secondes de travail de l’agent](docs/images/prompt.png)

## Fonctionnalités

- **Apparaît tout seul.** Après 10 secondes de travail de l’agent, Arcade propose un jeu au-dessus du prompt ; il ne prend jamais le focus sans que vous le demandiez.
- **Sait ce que fait l’agent.** Quand l’agent a fini ou demande une autorisation, un bandeau s’affiche sur le jeu — continuez à jouer, mettez en pause ou retournez directement à l’agent (le comportement se choisit dans les paramètres). Dans Claude Desktop, il peut aussi fermer l’onglet que vous regardez, pour que la conversation soit de nouveau devant vous.
- **Un menu, six sections.** *Jouer*, *Lire et écouter*, *Regarder*, *Social*, *Travail* et *Plus* — repliez celles dont vous n’avez pas besoin. En haut : *Continuer* la dernière partie, *Rechercher* et *Favoris*.
- **61 jeux gratuits** sur NES (Dendy), Sega Mega Drive, Master System, PlayStation et un onglet *Jeux* avec des jeux d’arcade, de tir, de course, de stratégie, d’aventure et de société.
- **Lire et écouter.** Des classiques et des livres audio LibriVox en 30 langues, directement depuis Project Gutenberg, Wikisource et LibriVox, ainsi que des articles et des épisodes de podcasts récents sur le sujet du travail de l’agent.
- **Regarder.** Des vidéos YouTube récentes sur le sujet du travail de l’agent, Twitch : vos propres chaînes et des directs sur le code, la tech, la science et le rétrogaming, et TikTok : le fil *Pour toi* et la recherche sur le site même de TikTok, où vous vous connectez vous-même.
- **NES et Flappy Arcade directement dans Claude Code** — dans le terminal, VS Code et Claude Desktop. Tout le reste s’ouvre dans une fenêtre de navigateur ; dans Claude Desktop, par défaut dans le navigateur intégré de Claude (les jeux de tir s’ouvrent quand même dans une fenêtre de navigateur : le navigateur intégré ne peut pas capturer la souris).
- **Jeu en ligne.** Jeux console à deux en réseau, deathmatch et coopération dans Doom, échecs, go, dames et reversi contre des personnes ou contre l’ordinateur.
- **« Qui attend en ligne ».** Arcade indique dans Claude Code quand quelqu’un attend un partenaire, avec un bouton *Rejoindre*.
- **Amis et discussions.** Une connexion GitHub facultative garde vos paramètres identiques sur tous vos ordinateurs et vous donne un @pseudo ; ajoutez des amis par leur pseudo exact, voyez qui est en ligne, invitez-les à jouer et discutez en tête-à-tête ou en groupe.
- **Carnet et tableaux de projets.** Des pages, des sous-pages et des checklists que Claude tient aussi ; envoyez une page vers Notion ou une autre application, ou importez-en une, via les connecteurs de Claude ; dictez dans la zone de saisie de Claude et déplacez le texte sur une page. Des tableaux avec des colonnes et des cartes — partagez-en un avec vos amis, et tout le monde travaille sur le même tableau.
- **Recherche et favoris.** Une seule recherche dans les jeux et les chaînes Twitch, regroupée par section et par genre ; marquez un jeu d’une ☆ pour le garder dans *★ Favoris*.
- **Vos propres jeux.** Ajoutez les ROM que vous possédez ; elles restent sur votre machine.
- **13 langues d’interface :** English, Русский, Українська, Español, Français, Deutsch, Português, Italiano, Polski, Türkçe, 日本語, 中文, 한국어 — d’après la langue du système ou du navigateur, anglais par défaut.

## Installation

Nécessite **Claude Code 2.1.275 ou plus récent**.

Dans un terminal, deux commandes : ajoutez la marketplace d’Arcade (ce dépôt), puis installez le plugin depuis celle-ci :

```
claude plugin marketplace add ArbakovMaxim/agent-arcade
claude plugin install arcade@agent-arcade
```

Ou dans une session Claude Code :

```
/plugin marketplace add ArbakovMaxim/agent-arcade
/plugin install arcade@agent-arcade
```

Le plugin est installé pour toutes les sessions et applications. L’extension VS Code n’a pas de commande `/plugin` : installez-le depuis un terminal, et l’extension le prendra en compte dans une nouvelle conversation.

**Mise à jour :**

```
/plugin marketplace update agent-arcade
/plugin update arcade@agent-arcade
```

Redémarrez ensuite Claude Code. La marketplace ne télécharge que le plugin — quelques Mio, sans le site —, donc une mise à jour prend quelques secondes. Si Arcade est déjà installé, vous n’avez rien à faire : la marketplace bascule d’elle-même à la prochaine mise à jour.

Si `/plugin update` affiche *already at the latest version* alors qu’une nouvelle version d’Arcade est sortie, la marketplace ne s’est pas actualisée. Pour savoir pourquoi, lancez `claude plugin marketplace update agent-arcade` dans un terminal. S’il indique *timed out*, laissez 10 minutes au clonage :

```
CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=600000 claude plugin marketplace update agent-arcade
```

Dans PowerShell : `$env:CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=600000; claude plugin marketplace update agent-arcade`. Relancez ensuite `/plugin update arcade@agent-arcade`.

**Désinstallation :** `/plugin uninstall arcade@agent-arcade`

## Utilisation

- **`/arcade`** ouvre le menu à tout moment.
- Quand l’agent travaille plus de 10 secondes, *« envie de jouer ? »* apparaît au-dessus du prompt : **`1`** — jouer ici, dans le panneau ; **`2`** — dans une fenêtre de navigateur (si disponible) ; **`3`** — pas maintenant.
- Flèches ou Tab pour choisir, Entrée pour ouvrir ; la souris fonctionne aussi. Les commandes sont indiquées sous chaque jeu.
- Quand l’agent a fini ou attend une autorisation, un bandeau s’affiche sur le jeu : **Retour à l’agent** ou **Continuer à jouer**.

### Le menu

| Section | Contenu |
|---|---|
| *(en haut)* | **▶ Continuer** la dernière partie, **🔍 Rechercher**, **★ Favoris** |
| **Jouer** | NES, Sega, Master System, PlayStation, Jeux ; *Rejoindre* quand quelqu’un attend en ligne ; **Mes jeux** |
| **Lire et écouter** | Livres, Livres audio, Articles, Podcasts |
| **Regarder** | YouTube, Twitch, TikTok |
| **Social** | Amis, Discussions, **Se connecter avec GitHub** (ou **Compte** une fois connecté) |
| **Travail** | Carnet, Tableau de projets |
| **Plus** | Fenêtre Arcade, Paramètres, 🌐 langue, 🐞 Signaler un bug, ☕ Soutenir le projet |

Cliquez sur le titre d’une section pour la replier ou la déplier. Une section repliée affiche `▸` et le nombre de tuiles qu’elle contient, et *Social* affiche aussi les nouveaux messages 💬 et les demandes d’ami 👥. Arcade se souvient des sections repliées. Une section dont vous n’avez pas besoin peut être masquée dans les **Paramètres** : elle disparaît complètement du menu, titre et tuiles compris ; *Plus*, qui contient les paramètres, reste toujours. Une fois connecté, l’en-tête du menu affiche votre @pseudo avec les mêmes compteurs.

La **recherche** démarre dès deux lettres et trouve un titre ou un genre, sans tenir compte de la casse ni des accents. Les résultats sont regroupés par section et par genre, par exemple *Jeux · Jeux de tir*. L’étoile ☆ à côté d’un jeu l’ajoute aux **★ Favoris** (jusqu’à 100), classés par section et par genre, les plus récents en premier. Les livres et les livres audio ont leur propre recherche, par titre ou par auteur.

### Où s’ouvre quoi

| | NES (Dendy), Flappy Arcade | Sega, Master System, PlayStation, autres Jeux ; livres, livres audio, articles, podcasts, vidéos |
|---|---|---|
| **Terminal** | dans le panneau (graphismes en pixels si le terminal les prend en charge, sinon blocs de texte) | fenêtre de navigateur |
| **VS Code** | dans le panneau | fenêtre de navigateur |
| **Claude Desktop** | dans le panneau | navigateur intégré de Claude ou fenêtre de navigateur (au choix dans les paramètres) ; jeux de tir — toujours une fenêtre de navigateur |

La fenêtre de navigateur est une fenêtre Arcade séparée (votre navigateur par défaut ou celui choisi dans les paramètres), pas un onglet parmi vos onglets habituels. Les discussions fonctionnent directement dans le panneau, dans le terminal et dans Desktop ; *Ouvrir dans une page* les ouvre de la même façon sur le site. Le carnet et les tableaux de projets vivent dans le panneau. TikTok s’ouvre dans le navigateur intégré de Claude dans Desktop, et ailleurs dans votre navigateur par défaut, où vous êtes probablement déjà connecté.

## Le catalogue

| Onglet | Contenu |
|---|---|
| **NES (Dendy)** | 28 jeux homebrew — plateformes, puzzles, tir, course : Thwaite, Nova the Squirrel, Super Uwol, Lala the Magical et d’autres |
| **Sega** | 11 jeux Mega Drive : Miniplanets, Tank Battle, Battle 4Tris, Pong et d’autres |
| **Master System** | 4 jeux : Balloon Master, SkyHaul, Food Fighter, Escape from Monster Dimension |
| **PlayStation** | Hello Pong |
| **Jeux → Jeux d’arcade** | Flappy Arcade — le jeu à un bouton d’Arcade : se joue directement dans le panneau et dans la fenêtre Arcade ; le parcours du jour est le même pour tout le monde, votre meilleur score est conservé |
| **Jeux → Jeux de tir** | Freedoom Phase 1 et 2 (remplaçants libres de Doom), le deathmatch FreeDM, Blasphemer (remplaçant libre de Heretic), le deathmatch BlasphDM, OpenArena — jeu de tir en arène sur le moteur de Quake III contre des bots (GPL-2.0) |
| **Jeux → Jeux de course** | HexGL — course futuriste antigravité |
| **Jeux → Stratégie** | OpenTTD — magnat du transport (GPL-2.0) ; Micropolis — le code ouvert du célèbre jeu de construction de ville de 1989, votre ville est enregistrée dans le navigateur (micropolisJS, GPL-3.0 avec conditions supplémentaires et la Micropolis Public Name License) ; Warzone 2100 — stratégie en temps réel avec campagne et escarmouche contre l’ordinateur, vous concevez vos propres unités, les sauvegardes restent dans le navigateur (GPL-2.0-or-later) |
| **Jeux → Aventures** | Quatre aventures classiques gratuites des années 90 dans ScummVM (GPL-3.0-or-later) : Beneath a Steel Sky, Flight of the Amazon Queen, Lure of the Temptress et Nippon Safes, Inc. — données de jeu freeware redistribuables avec autorisation ; sauvegarde à tout moment avec F5 |
| **Jeux → Jeux de société** | Échecs — contre des personnes ou l’ordinateur (Stockfish, niveaux 1 à 10), en ligne avec pendule ; go sur plateaux 9×9, 13×13 et 19×19 ; dames russes, reversi ; *Abandonner* dans tous |
| **Livres** | Des classiques du domaine public en 30 langues — c’est vous qui choisissez la langue (au départ, celle de l’interface). Les sections sont les mêmes dans toutes les langues : Populaires, Romans, Poésie, Théâtre, Aventure, Policiers et d’autres ; la recherche se fait par titre ou par auteur. La liste arrive à la demande depuis Project Gutenberg et Wikisource — Arcade ne stocke aucun livre ; un livre ouvert reste dans *Mes livres* de votre navigateur. Le marque-page se place tout seul : rouvrez un livre et vous reprenez là où vous vous étiez arrêté. Vos propres EPUB, FB2 et TXT s’ouvrent aussi dans la fenêtre Arcade |
| **Livres audio** | Des enregistrements LibriVox dans les mêmes langues et les mêmes sections, avec recherche : écoutez en ligne directement depuis archive.org, ou téléchargez un livre dans votre navigateur pour l’écouter hors ligne. Le lecteur de la fenêtre Arcade retient le chapitre, la position et la vitesse ; vos fichiers MP3, M4A, M4B, OGG et Opus s’y ouvrent aussi et restent dans votre navigateur |
| **Articles** | Articles récents de 106 blogs et publications anglophones sélectionnés — Simon Willison, InfoQ, The Cloudflare Blog, Ars Technica, Krebs on Security et d’autres |
| **Podcasts** | Épisodes récents de 65 podcasts anglophones — Software Engineering Daily, Security Now, Talk Python To Me, Darknet Diaries et d’autres ; chaque épisode retient où vous vous êtes arrêté |
| **YouTube** | Vidéos récentes de 153 chaînes sélectionnées dans 24 domaines, de l’IA, du web et du DevOps à la science, à l’espace et au rétro-informatique |
| **Twitch** | *Mes chaînes* — n’importe quelle chaîne Twitch par nom ou lien, celles en direct d’abord ; *En direct maintenant* et *Catalogue complet* — 26 chaînes anglophones sélectionnées, sans chaînes 18+ ; aucune inscription nécessaire |

La fiche de chaque jeu renvoie à sa licence et à son code source.

**Sujets.** Articles, Podcasts et YouTube commencent par des sujets : Haiku en propose trois sur ce sur quoi travaille l’agent, plus *Nouveautés et présentations*. Dans *Votre sujet*, vous pouvez écrire ce que vous voulez regarder, lire ou écouter, dans n’importe quelle langue ; vos cinq derniers sujets restent en tuiles dans *Mes sujets*.

## Jeu en ligne

- **Consoles.** Les jeux à deux sur NES, Sega, Master System et PlayStation ont un bouton **En ligne** : créez une salle ou rejoignez celle de quelqu’un. Les commandes sont synchronisées image par image via le serveur d’Arcade.
- **Doom.** **FreeDM** et **BlasphDM** sont des salons de deathmatch avec des manches de 5 minutes, jusqu’à quatre joueurs ; **Freedoom** et **Blasphemer** proposent la coopération via **En ligne**. Les nouveaux venus attendent la manche suivante : le moteur ne permet pas de rejoindre une partie en cours.
- **Jeux de société.** *Trouver un adversaire*, *Inviter un ami* par lien, ou *Contre l’ordinateur*. La partie est enregistrée sur le serveur : jouez un coup, retournez à votre agent, rouvrez le lien plus tard — le plateau est là où vous l’avez laissé. Connecté avec un @pseudo, votre adversaire le voit à côté de votre couleur.
- **Qui attend.** Une fois par minute, Arcade vérifie si quelqu’un attend un partenaire et l’affiche dans Claude Code — par exemple *« envie de jouer ? En attente en ligne : FreeDM (1) »* — avec un bouton **Rejoindre** dans le menu.

## Compte, amis et discussions

La connexion est facultative : sans elle, tout le reste fonctionne comme avant.

- **Se connecter avec GitHub** (dans *Social*) : Arcade affiche un code que vous saisissez sur la page de GitHub dans votre navigateur habituel. Arcade ne connaît que le nom et l’image de votre profil GitHub — pas d’e-mail, aucun accès aux dépôts.
- **Synchronisation.** Votre langue, vos touches, vos notifications, la taille du panneau, ce qu’il faut faire du jeu quand l’agent signale, les options du navigateur dans Desktop, vos sujets, vos chaînes Twitch, vos favoris, les sections repliées et masquées, et votre record à Flappy Arcade deviennent identiques sur tous vos ordinateurs. Vos propres jeux, le navigateur et le mode graphique restent propres à chaque ordinateur.
- **@pseudo.** Reprenez votre nom GitHub en un clic ou inventez-en un : de 4 à 32 caractères — lettres latines, chiffres et `_`. Vous pouvez le changer jusqu’à 5 fois par jour.
- **Amis.** Ajoutez un ami par son @pseudo exact : il accepte la demande de son côté, et vous apparaissez dans vos listes respectives. Il n’y a pas de suggestions pendant la saisie, donc personne ne peut parcourir qui utilise Arcade. Refuser et supprimer se font en silence.
- **En ligne et invitations à jouer.** Tant que le menu d’Arcade est ouvert, vos amis vous voient *en ligne*, et vous les voyez ; pour rester invisible, désactivez *Montrer à mes amis que je suis en ligne* sur l’écran *Amis*. *Inviter* à côté d’un ami propose les jeux en réseau : un jeu de société ouvre une salle rien que pour vous deux, un jeu Doom son lobby. Le jeu s’ouvre aussitôt chez vous ; votre ami reçoit une notification et *Accepter* en haut du menu, et l’invitation est valable 10 minutes. On peut inviter là où les jeux en réseau s’ouvrent dans un navigateur : celui intégré à Desktop ou une fenêtre du navigateur.
- **Discussions.** En tête-à-tête avec un ami, en groupe d’amis, ou un groupe avec tous vos amis en un clic. Écrivez directement dans le panneau Arcade ou ouvrez la page des discussions sur le site. Les messages sont stockés sur le site d’Arcade et ne sont pas chiffrés — n’y écrivez ni mots de passe ni clés.
- **Avatars et notifications de messages.** Choisissez l’un des 24 avatars prêts à l’emploi dans *Compte* — les discussions ne font que l’afficher ; sans avatar, c’est la première lettre de votre @pseudo. L’image d’un groupe est choisie par son propriétaire parmi les mêmes 24. Votre image GitHub n’est jamais montrée aux autres. Quand un ami vous écrit, une carte apparaît en bas à gauche au-dessus de toutes les fenêtres (Windows) ou une notification système (macOS, Linux) ; un clic sur la carte ouvre cette discussion.
- **Se déconnecter** arrête la synchronisation sur cet ordinateur ; **Supprimer le compte** (appuyez deux fois) fait oublier au site votre compte et vos paramètres.

## Carnet et tableaux de projets

Les deux se trouvent dans la section *Travail* du menu.

- **Carnet.** Des pages et des sous-pages ; une ligne qui commence par `# ` est un titre, par `- ` un élément, par `- [ ] ` un élément de checklist qui se coche d’un clic. Il est conservé sur cet ordinateur — jusqu’à 200 pages, 20 000 caractères par page.
- **Claude le tient aussi.** *Donner à Claude* transmet une page à Claude, ou demandez simplement à Claude de noter quelque chose dans Arcade. Claude utilise l’outil `mcp__arcade__notes`, qui ne modifie que le carnet et ne supprime rien. Si la modification de Claude ne vous plaît pas : *Rétablir le texte d’avant la modification de Claude*.
- **Notion et autres applications** — via les connecteurs de Claude, donc Arcade n’a besoin d’aucune clé ni d’aucun mot de passe : *Envoyer vers Notion*, *Vers une autre application*, *Importer depuis Notion ou une autre application*. Une page liée peut être mise à jour dans l’application ou réimportée depuis celle-ci.
- **À la voix.** Dictez dans la zone de saisie de Claude avec la dictée du système (Win+H sous Windows, deux fois Fn sous macOS), puis appuyez sur *Prendre dans la zone de saisie de Claude* — le texte passe à la fin de la page.
- **Tableau de projets.** Des colonnes — *À faire*, *En cours*, *Fait* ou les vôtres, jusqu’à 8 — et des cartes ; une carte est une page du carnet avec du texte et une checklist. Appuyez sur une carte pour la choisir et la déplacer avec les flèches, appuyez encore pour l’ouvrir. Claude peut aussi gérer un tableau : *Donner à Claude*, ou demandez-lui de répartir des tâches sur un tableau dans Arcade.
- **Tableaux partagés.** Une fois connecté avec un @pseudo, cochez des amis et appuyez sur *Partager* : tout le monde a les mêmes cartes, colonnes et nom, et les modifications arrivent en quelques secondes. Le propriétaire invite d’autres amis, retire des participants et supprime le tableau du site ; chacun peut le quitter ; quoi qu’il arrive, chacun garde sa propre copie. Jusqu’à 3 tableaux partagés dont vous êtes propriétaire, 20 personnes et 200 cartes par tableau.

## Vos propres jeux

- **`/arcade-add <fichier>`** ajoute une ROM NES, Mega Drive ou Master System (jusqu’à 4 Mo). Le plugin en garde une copie dans `~/.claude/arcade` et ne l’envoie jamais nulle part.
- **Disques PlayStation et WAD de Doom** (par exemple un `doom.wad` que vous possédez) — dans la fenêtre Arcade : **Ouvrir votre propre fichier**. Ils restent uniquement dans ce navigateur.

N’ajoutez que des fichiers sur lesquels vous avez des droits.

## Paramètres

Ouvrez **Paramètres** dans la section *Plus* du menu `/arcade` :

- **Sections du menu principal** — afficher ou masquer n’importe quelle section sauf *Plus* ; une section masquée disparaît complètement du menu jusqu’à ce que vous la rétablissiez ici.
- **Langue** — l’une des 13 (aussi directement dans le menu : 🌐).
- **Ouvrir les jeux** — ici dans le panneau, dans une fenêtre de navigateur ou dans un navigateur précis ; dans Claude Desktop — dans le navigateur intégré de Claude ou dans une fenêtre de navigateur.
- **Graphismes** (terminal) — pixels dans les terminaux qui affichent des images (kitty, Ghostty, Rio), blocs de texte partout ailleurs.
- **Taille du panneau** — normale ou pleine largeur.
- **Quand l’agent termine** — bandeau et continuer à jouer, pause avec bandeau, ou retour direct à l’agent.
- **Quand l’agent demande une autorisation** — les trois mêmes options.
- **À l’ouverture du navigateur** (Claude Desktop) — fermer le menu Arcade pour que le navigateur ait toute la hauteur, ou garder le menu au-dessus.
- **L’agent a terminé pendant que vous regardez** (Claude Desktop) — fermer l’onglet qu’Arcade a ouvert pour une vidéo, un direct, TikTok, un article ou un épisode, pour que la discussion avec Claude soit de nouveau devant vous, ou seulement vous prévenir.
- **Notifications pendant le jeu dans une fenêtre.**
- **Notifications de messages** — une carte en bas à gauche quand un ami écrit dans une discussion (une notification système sous macOS et Linux).
- **Test des touches et réattribution des touches** (terminal).

## Confidentialité

- Pas de publicité, pas d’analytique, pas de pistage. Les jeux livrés avec de l’analytique en ont été débarrassés (voir le `NOTICE` de chaque jeu).
- Vos ROM, WAD, livres et fichiers audio ne quittent jamais votre machine ni votre navigateur.
- Les listes de livres et de livres audio, ainsi que les livres de Project Gutenberg, passent par le site d’Arcade, qui les demande à Project Gutenberg, Wikisource et archive.org et ne les garde que dans le cache de Cloudflare — les listes six heures, un livre une semaine. Les pages de Wikisource et les enregistrements LibriVox, la fenêtre les charge directement depuis ces sites.
- Le jeu en ligne passe par le serveur d’Arcade sur Cloudflare : les messages sont relayés entre les joueurs d’une salle et ne sont pas stockés — sauf les coups des jeux de société, conservés pour que vous puissiez revenir ; une partie inactive pendant un mois est supprimée.
- Les sujets sont proposés par Haiku dans votre propre session Claude Code ; le site d’Arcade ne voit jamais votre conversation — seulement une courte requête de recherche en anglais quand vous utilisez *Votre sujet*. L’adresse d’un article passe après `#`, elle n’atteint donc jamais le serveur d’Arcade.
- Une fois connecté, le site conserve vos paramètres synchronisés, vos favoris, votre @pseudo, vos amis, vos discussions et vos tableaux partagés, ainsi que les invitations à jouer pendant 10 minutes. Qui est en ligne, il ne le garde qu’en mémoire, une minute et demie. La clé de session n’est envoyée qu’au site d’Arcade.
- Le carnet reste sur votre ordinateur. Les tableaux partagés sont stockés sur le site d’Arcade et ne sont pas chiffrés, comme les discussions. Les pages ne partent vers Notion ou une autre application que si vous le demandez, via vos propres connecteurs Claude.
- Un rapport de bug contient votre texte, la version d’Arcade, l’endroit où il est ouvert, la langue de l’interface et le système d’exploitation — rien d’autre ; sans connexion, il est envoyé sans signature, et le site ne conserve aucune adresse.
- Certains jeux n’accèdent à Internet que si vous le demandez — par exemple le sondage facultatif d’OpenTTD et son bouton *Online Content*.

## Plateformes et état

Arcade est en **alpha** et en développement actif — voir le [journal des modifications](CHANGELOG.md).

- Testé en conditions réelles sous Windows, macOS et Linux.
- Fonctionne dans le terminal, dans VS Code et dans Claude Desktop.

## Licences

- **Jeux :** chaque jeu a sa propre licence libre (MIT, GPL, BSD, Apache, Creative Commons et d’autres) — le texte de la licence et le code source se trouvent à côté du jeu et sont liés depuis sa fiche.
- **Livres et livres audio :** domaine public ; Arcade ne les stocke pas — les livres viennent de Project Gutenberg et de Wikisource, les enregistrements de LibriVox (archive.org), au moment où vous les ouvrez.
- **Émulateurs et moteurs :** JSNES (Apache-2.0), EmulatorJS (GPL-3.0) avec ses cœurs, PrBoom (GPL-2.0), doom-wasm de Cloudflare et Chocolate Doom/Heretic (GPL-2.0), OpenTTD (GPL-2.0), micropolisJS (GPL-3.0 avec conditions supplémentaires), ScummVM (GPL-3.0-or-later), Stockfish (GPL-3.0) — l’adversaire aux échecs. Le cœur Genesis Plus GX utilisé pour Sega et Master System est réservé à un usage non commercial.
- **Le code d’Arcade** (le plugin et le site) — **GNU AGPL-3.0** ([LICENSE](LICENSE)), © 2026 Max Arbakov. Vous êtes libre de l’utiliser, de l’étudier et de le modifier. Si vous distribuez une version modifiée — ou la faites tourner comme service en ligne pour d’autres personnes —, vous devez publier l’intégralité de votre code source sous la même licence et conserver les mentions de droits d’auteur. Les composants tiers gardent leurs propres licences.

## Soutenir le projet

Arcade est gratuit. S’il rend vos attentes plus agréables, vous pouvez offrir un café au projet — c’est entièrement facultatif : **[ko-fi.com/agentarcade](https://ko-fi.com/agentarcade)**. Le même lien se trouve en bas du menu `/arcade` (*☕ Soutenir le projet*) et dans la fenêtre Arcade. Rien dans Arcade n’en dépend, et cela n’interrompt jamais une partie.

## Retours

Vous avez trouvé un bug ? Le plus rapide, c’est directement dans Arcade : **Plus → 🐞 Signaler un bug**. Décrivez ce qui ne va pas, et le rapport part directement à l’auteur d’Arcade avec la version, l’environnement, la langue et le système d’exploitation.

Vous pouvez aussi ouvrir une [issue](https://github.com/ArbakovMaxim/agent-arcade/issues), pour les bugs comme pour les idées. Indiquez votre système d’exploitation, votre environnement Claude Code (terminal, VS Code ou Desktop) et le jeu.

Les pull requests sont les bienvenues. En en envoyant une, vous acceptez que votre contribution soit placée sous AGPL-3.0 et que l’auteur puisse aussi proposer Arcade sous d’autres conditions (par exemple une licence commerciale).

## Pour les développeurs

```
mod/     le plugin Claude Code (hooks, interface du panneau, tests)
site/    le site sur Cloudflare Workers : catalogue, fenêtre Arcade, salles réseau, comptes, amis, discussions, rapports de bug
tools/   outils de construction : traductions, heretic-wasm
.github/ GitHub Actions qui compilent doom-wasm, heretic-wasm, OpenTTD et ScummVM pour le navigateur
```

- Lancer le plugin depuis le dépôt : `claude --plugin-dir ./mod`
- Tests du plugin : `claude plugin validate ./mod`, puis `claude plugin test` dans `mod/`
- Tests du site : `npm test` dans `site/` ; build : `node build.mjs` ; le déploiement se fait automatiquement depuis `main` via Cloudflare Workers Builds.
- Le travail se fait dans `main`, et les pull requests y vont aussi. La branche par défaut `plugin` est une copie de `main` sans `site/`, mise à jour par une GitHub Action à chaque push : la marketplace de plugins télécharge cette branche plutôt que tout le dépôt.
- Traductions : `node tools/i18n/collect.mjs`, puis `node tools/i18n/check.mjs` — voir [tools/i18n/README.md](tools/i18n/README.md).

Documentation détaillée (en russe) : [mod/README.md](mod/README.md) — le plugin, [site/README.md](site/README.md) — le site, l’ajout de jeux et le jeu en réseau.
