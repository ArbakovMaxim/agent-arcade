<img src="docs/brand/arcade-logo-2-512.png" width="96" alt="Logo do Arcade" align="right">

# Arcade — jogue, leia, ouça e assista enquanto seu agente do Claude Code trabalha

[English](README.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · **Português** · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [日本語](README.ja.md) · [中文](README.zh.md) · [한국어](README.ko.md)

> **Beta (0.35).** Tudo o que está descrito aqui funciona e é usado todos os dias; daqui em diante, mudam principalmente os detalhes. Relatos de erros são muito bem-vindos — veja [Feedback](#feedback).

O Arcade é um plugin para o [Claude Code](https://claude.com/claude-code) que preenche a espera enquanto seu agente trabalha. Quando o agente fica ocupado por mais de 10 segundos, um pequeno *«jogar?»* aparece acima do prompt. Jogue alguma coisa — NES, Sega, PlayStation, Doom, xadrez e mais —, leia um livro, ouça um audiolivro ou um podcast, ou assista a um vídeo sobre o assunto em que o agente está trabalhando. O Arcade avisa assim que o agente termina ou precisa da sua permissão — você não perde nada.

Tudo no catálogo é gratuito: os jogos têm licenças abertas, os livros e audiolivros são de domínio público. Você também pode jogar online com outras pessoas que estão esperando seus agentes e conversar com seus amigos.

![Demonstração: o Claude Code recebe uma tarefa, «jogar?» aparece acima do prompt, um jogo de NES roda ao lado do chat e o Arcade avisa você quando o agente termina; também há livros, audiolivros e artigos](https://github.com/user-attachments/assets/3d8f79ac-966f-4872-84d5-7aa91534330d)

*31 segundos no Claude Desktop, com a interface em inglês. [Ver o vídeo em 720p](https://github.com/user-attachments/assets/1c21bf5c-f5c7-4671-a453-bdcf6aa4b287).*

## Recursos

- **Aparece sozinho.** Depois de 10 segundos de trabalho do agente, o Arcade oferece um jogo acima do prompt; ele nunca toma o foco a menos que você peça.
- **Sabe o que o agente está fazendo.** Quando o agente termina ou pede permissão, um aviso aparece sobre o jogo — continue jogando, pause ou volte direto ao agente (você escolhe o comportamento nas configurações). No Claude Desktop ele também pode fechar a aba que você está assistindo, para a conversa voltar à sua frente.
- **Um menu, seis seções.** *Jogar*, *Ler e ouvir*, *Assistir*, *Social*, *Trabalho* e *Mais* — recolha as que você não precisa. No topo: *Continuar* o último jogo, *Buscar* e *Favoritos*. Na primeira vez que você abre o Arcade, escolhe quais seções mostrar.
- **61 jogos gratuitos** para NES (Dendy), Sega Mega Drive, Master System, PlayStation e uma aba *Jogos* com jogos de arcade, tiro, corrida, estratégia, aventuras e jogos de tabuleiro.
- **Ler e ouvir.** Clássicos e audiolivros do LibriVox em 30 idiomas, direto do Project Gutenberg, do Wikisource e do LibriVox, além de artigos e episódios recentes de podcasts sobre o assunto do trabalho do agente.
- **Assistir.** Vídeos recentes do YouTube sobre o assunto do trabalho do agente, Twitch: seus próprios canais e transmissões ao vivo sobre programação, tecnologia, ciência e jogos retrô, e TikTok: o feed *Para você* e a busca no próprio site do TikTok, onde você entra por conta própria.
- **NES e Flappy Arcade direto no Claude Code** — no terminal, no VS Code e no Claude Desktop. Todo o resto abre em uma janela do navegador; no Claude Desktop, por padrão, no navegador integrado do Claude (os jogos de tiro ainda abrem em uma janela do navegador: o navegador integrado não consegue capturar o mouse).
- **Jogo online.** Jogos de console para dois pela rede, deathmatch e cooperativo no Doom, xadrez, go, damas e reversi contra pessoas ou contra o computador.
- **«Quem está esperando online».** O Arcade mostra no Claude Code quando alguém está esperando um parceiro, com um botão *Entrar*.
- **Amigos e conversas.** Um login opcional com o GitHub mantém suas configurações iguais em todos os seus computadores e dá a você um @apelido; adicione amigos pelo apelido exato, veja quem está online, convide-os para jogar e converse a dois ou em grupos.
- **Caderno e quadros de projetos.** Páginas, subpáginas e checklists que o Claude também mantém; envie uma página para o Notion ou outro aplicativo, ou traga uma de lá, pelos conectores do Claude; dite na caixa de mensagem do Claude e leve o texto para uma página. Quadros com colunas e cartões — compartilhe um com amigos, e todos trabalham no mesmo quadro.
- **Busca e favoritos.** Uma única busca em jogos e canais da Twitch, agrupada por seção e gênero; marque um jogo com ☆ para guardá-lo em *★ Favoritos*.
- **Seus próprios jogos.** Adicione ROMs que você possui; elas ficam no seu computador.
- **13 idiomas de interface:** English, Русский, Українська, Español, Français, Deutsch, Português, Italiano, Polski, Türkçe, 日本語, 中文, 한국어 — pelo idioma do sistema ou do navegador, inglês por padrão.

## Instalação

Requer o **Claude Code 2.1.275 ou mais recente**.

No terminal, dois comandos: adicione o marketplace do Arcade (este repositório) e depois instale o plugin a partir dele:

```
claude plugin marketplace add ArbakovMaxim/agent-arcade
claude plugin install arcade@agent-arcade
```

Ou dentro de uma sessão do Claude Code:

```
/plugin marketplace add ArbakovMaxim/agent-arcade
/plugin install arcade@agent-arcade
```

O plugin é instalado para todas as sessões e aplicativos. A extensão do VS Code não tem o comando `/plugin` — instale pelo terminal, e a extensão vai reconhecê-lo em uma nova conversa.

**Atualizar:**

```
/plugin marketplace update agent-arcade
/plugin update arcade@agent-arcade
```

Depois reinicie o Claude Code. O marketplace baixa só o plugin — alguns MiB, sem o site —, então atualizar leva segundos. Se o Arcade já estiver instalado, não é preciso fazer nada: o marketplace muda sozinho na próxima atualização.

Se `/plugin update` disser *already at the latest version* mas já saiu uma versão nova do Arcade, o marketplace não foi atualizado. Para ver o motivo, rode `claude plugin marketplace update agent-arcade` em um terminal. Se aparecer *timed out*, dê 10 minutos para o clone:

```
CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=600000 claude plugin marketplace update agent-arcade
```

No PowerShell: `$env:CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=600000; claude plugin marketplace update agent-arcade`. Depois rode `/plugin update arcade@agent-arcade` de novo.

**Desinstalar:** `/plugin uninstall arcade@agent-arcade`

## Como usar

- **`/arcade`** abre o menu a qualquer momento.
- Quando o agente trabalha por mais de 10 segundos, *«jogar?»* aparece acima do prompt: **`1`** — jogar aqui, no painel; **`2`** — em uma janela do navegador (onde houver); **`3`** — agora não. Em Configurações → Notificações você escolhe quando ele aparece — de 10 segundos a 5 minutos — ou o desativa.
- Setas ou Tab para escolher, Enter para abrir; o mouse também funciona. Os controles aparecem abaixo de cada jogo.
- Quando o agente termina ou espera uma permissão, um aviso aparece sobre o jogo: **Voltar ao agente** ou **Continuar jogando**.

### O menu

| Seção | O que contém |
|---|---|
| *(topo)* | **▶ Continuar** o último jogo, **🔍 Buscar**, **★ Favoritos** |
| **Jogar** | NES, Sega, Master System, PlayStation, Jogos; *Entrar* quando alguém espera online; **Meus jogos** |
| **Ler e ouvir** | Livros, Audiolivros, Artigos, Podcasts |
| **Assistir** | YouTube, Twitch, TikTok |
| **Social** | Amigos, Conversas, **Entrar com o GitHub** (ou **Conta** depois de entrar) |
| **Trabalho** | Caderno, Quadro de projetos |
| **Mais** | Janela do Arcade, Configurações, 🌐 idioma, 🐞 Relatar um erro, ☕ Apoiar o projeto |

Clique no título de uma seção para recolhê-la ou expandi-la. Uma seção recolhida mostra `▸` e quantos blocos ela contém, e *Social* também mostra novas mensagens 💬 e pedidos de amizade 👥. O Arcade lembra quais seções estão recolhidas. Uma seção de que você não precisa pode ser ocultada em **Configurações**: ela some do menu por completo, com título e blocos; *Mais*, com as configurações, fica sempre. Depois de entrar, o cabeçalho do menu mostra seu @apelido com os mesmos contadores.

A **busca** começa a partir de duas letras e encontra título ou gênero, sem diferenciar maiúsculas nem acentos. Os resultados são agrupados por seção e gênero, por exemplo *Jogos · Tiro*. A estrela ☆ ao lado de um jogo o adiciona a **★ Favoritos** (até 100), organizados por seção e gênero, os mais recentes primeiro. Livros e audiolivros têm busca própria, por título ou autor.

### Onde cada coisa abre

| | NES (Dendy), Flappy Arcade | Sega, Master System, PlayStation, outros Jogos; livros, audiolivros, artigos, podcasts, vídeos |
|---|---|---|
| **Terminal** | no painel (gráficos em pixels onde o terminal suporta, senão blocos de texto) | janela do navegador |
| **VS Code** | no painel | janela do navegador |
| **Claude Desktop** | no painel | navegador integrado do Claude ou janela do navegador (escolha nas configurações); jogos de tiro — sempre uma janela do navegador |

A janela do navegador é uma janela separada do Arcade (no seu navegador padrão ou no escolhido nas configurações), não uma aba entre as suas. As conversas funcionam direto no painel — no terminal e no Desktop; *Abrir como página* as abre do mesmo jeito no site. O caderno e os quadros de projetos ficam no painel. O TikTok abre no navegador integrado do Claude no Desktop e, nos outros lugares, no seu navegador padrão, onde você provavelmente já entrou na conta.

## O catálogo

| Aba | O que contém |
|---|---|
| **NES (Dendy)** | 28 jogos homebrew — plataforma, quebra-cabeças, tiro, corrida: Thwaite, Nova the Squirrel, Super Uwol, Lala the Magical e outros |
| **Sega** | 11 jogos de Mega Drive: Miniplanets, Tank Battle, Battle 4Tris, Pong e outros |
| **Master System** | 4 jogos: Balloon Master, SkyHaul, Food Fighter, Escape from Monster Dimension |
| **PlayStation** | Hello Pong |
| **Jogos → Jogos de arcade** | Flappy Arcade — o jogo de um botão do próprio Arcade: roda direto no painel e na janela do Arcade; o percurso do dia é o mesmo para todos, e seu recorde fica salvo |
| **Jogos → Tiro** | Freedoom Phase 1 e 2 (substitutos livres do Doom), o deathmatch FreeDM, Blasphemer (substituto livre do Heretic), o deathmatch BlasphDM, OpenArena — tiro em arena no motor do Quake III contra bots (GPL-2.0) |
| **Jogos → Corrida** | HexGL — corrida futurista antigravidade |
| **Jogos → Estratégia** | OpenTTD — magnata dos transportes (GPL-2.0); Micropolis — o código aberto do clássico jogo de construção de cidades de 1989, sua cidade é salva no navegador (micropolisJS, GPL-3.0 com termos adicionais e a Micropolis Public Name License); Warzone 2100 — estratégia em tempo real com campanha e escaramuça contra o computador, você projeta suas próprias unidades, os jogos salvos ficam no navegador (GPL-2.0-or-later) |
| **Jogos → Aventuras** | Quatro aventuras clássicas gratuitas dos anos 90 no ScummVM (GPL-3.0-or-later): Beneath a Steel Sky, Flight of the Amazon Queen, Lure of the Temptress e Nippon Safes, Inc. — dados de jogo freeware redistribuíveis com permissão; salve a qualquer momento com F5 |
| **Jogos → Jogos de tabuleiro** | Xadrez — contra pessoas ou o computador (Stockfish, níveis 1–10), online com relógio; go em tabuleiros 9×9, 13×13 e 19×19; damas russas, reversi; *Desistir* em todos |
| **Livros** | Clássicos de domínio público em 30 idiomas — você escolhe o idioma (no início, o da interface). As seções são as mesmas em todos os idiomas: Populares, Ficção, Poesia, Teatro, Aventura, Policiais e outras; a busca é por título ou autor. A lista vem sob demanda do Project Gutenberg e do Wikisource — o Arcade não guarda livros próprios; o livro aberto fica em *Meus livros* do seu navegador. O marcador se coloca sozinho: reabra um livro e você volta para onde parou. Seus próprios arquivos EPUB, FB2 e TXT também abrem na janela do Arcade |
| **Audiolivros** | Gravações do LibriVox nos mesmos idiomas e seções, com busca: ouça on-line direto do archive.org ou baixe um livro no navegador para ouvir off-line. O player da janela do Arcade lembra o capítulo, o ponto e a velocidade; seus próprios arquivos MP3, M4A, M4B, OGG e Opus também abrem lá e ficam no seu navegador |
| **Artigos** | Artigos recentes de 106 blogs e publicações selecionados em inglês — Simon Willison, InfoQ, The Cloudflare Blog, Ars Technica, Krebs on Security e outros |
| **Podcasts** | Episódios recentes de 65 podcasts em inglês — Software Engineering Daily, Security Now, Talk Python To Me, Darknet Diaries e outros; cada episódio lembra onde você parou |
| **YouTube** | Vídeos recentes de 153 canais selecionados em 24 áreas, de IA, web e DevOps a ciência, espaço e computação retrô |
| **Twitch** | *Meus canais* — qualquer canal da Twitch por nome ou link, os ao vivo primeiro; *Ao vivo agora* e *Catálogo completo* — 26 canais selecionados em inglês, sem canais 18+; não é preciso cadastro |

O cartão de cada jogo tem links para a licença e o código-fonte.

**Temas.** Artigos, Podcasts e YouTube começam com temas: o Haiku sugere três sobre o que o agente está fazendo, além de *Novidades e apresentações*. Em *Seu próprio tema* você pode digitar o que quer ver, ler ou ouvir, em qualquer idioma; seus cinco últimos temas ficam como blocos em *Meus temas*.

## Jogo online

- **Consoles.** Jogos para dois no NES, Sega, Master System e PlayStation têm um botão **Online**: crie uma sala ou entre na de outra pessoa. Os comandos são sincronizados quadro a quadro pelo servidor do Arcade.
- **Doom.** **FreeDM** e **BlasphDM** são salas de deathmatch com rodadas de 5 minutos para até quatro jogadores; **Freedoom** e **Blasphemer** oferecem cooperativo pelo **Online**. Quem chega espera a próxima rodada — o motor não permite entrar em uma partida em andamento.
- **Jogos de tabuleiro.** *Encontrar adversário*, *Convidar um amigo* por link, ou *Contra o computador*. A partida fica salva no servidor: faça uma jogada, volte ao seu agente, abra o link depois — o tabuleiro estará como você deixou. Se você entrou com um @apelido, o adversário o vê ao lado da sua cor.
- **Quem está esperando.** Uma vez por minuto o Arcade verifica se alguém está esperando um parceiro e mostra isso no Claude Code — por exemplo *«jogar? Esperando online: FreeDM (1)»* — com um botão **Entrar** no menu.

## Conta, amigos e conversas

Entrar é opcional — sem isso, todo o resto funciona como antes.

- **Entrar com o GitHub** (em *Social*): a página de login do GitHub abre no seu navegador de sempre; confirme lá e depois clique em *Sign in* na página do Arcade — o código dela deve ser o mesmo do painel. Se pelo navegador não der certo, use *Entrar com um código*: o Arcade mostra um código que você digita na página do GitHub. O Arcade só fica sabendo o nome e a imagem do seu perfil do GitHub — nenhum e-mail, nenhum acesso a repositórios.
- **Sincronização.** Idioma, teclas, notificações, tamanho do painel, o que fazer com o jogo quando o agente avisa, as opções do navegador no Desktop, seus temas, canais da Twitch, favoritos, seções recolhidas, seções ocultas e seu recorde no Flappy Arcade ficam iguais em todos os seus computadores. Seus próprios jogos, o navegador e o modo gráfico continuam por computador.
- **@apelido.** Use seu nome do GitHub com um clique ou invente um: de 4 a 32 caracteres — letras latinas, números e `_`. Você pode mudá-lo até 5 vezes por dia.
- **Amigos.** Adicione um amigo pelo @apelido exato: o pedido é aceito do outro lado, e vocês aparecem nas listas um do outro. Não há sugestões enquanto você digita, então ninguém consegue vasculhar quem usa o Arcade. Recusar e remover acontecem em silêncio.
- **Online e convites para jogar.** Enquanto o menu do Arcade está aberto, seus amigos veem você *online*, e você a eles; para não aparecer, desative *Mostrar aos amigos que estou online* na tela *Amigos*. *Convidar* ao lado de um amigo oferece os jogos em rede: um jogo de tabuleiro abre uma sala só para vocês dois, um jogo de Doom o seu lobby. O jogo abre para você na hora; seu amigo recebe uma notificação e *Aceitar* no topo do menu, e o convite vale por 10 minutos. Dá para convidar onde os jogos em rede abrem em um navegador — o integrado do Desktop ou uma janela do navegador.
- **Conversas.** A dois com um amigo, grupos de amigos, ou um grupo com todos os seus amigos em um clique. Escreva direto no painel do Arcade ou abra a página de conversas no site. Suas próprias mensagens podem ser editadas ou excluídas pelo menu ⋮ ao lado delas; no site, o clique com o botão direito abre o mesmo menu. As mensagens ficam guardadas no site do Arcade e não são criptografadas — não escreva senhas nem chaves nelas.
- **Avatares e notificações de mensagens.** Escolha um dos 24 avatares prontos em *Conta* — as conversas só o mostram; sem avatar, aparece a primeira letra do seu @apelido. A imagem de um grupo é escolhida pelo dono entre os mesmos 24. Sua imagem do GitHub nunca é mostrada aos outros. Quando um amigo escreve, um cartão aparece no canto inferior esquerdo sobre todas as janelas (Windows) ou uma notificação do sistema (macOS, Linux); um clique no cartão abre essa conversa.
- **Sair** interrompe a sincronização neste computador; **Excluir conta** (pressione duas vezes) faz o site esquecer você e suas configurações.

## Caderno e quadros de projetos

Os dois ficam na seção *Trabalho* do menu.

- **Caderno.** Páginas e subpáginas; uma linha que começa com `# ` é um título, com `- ` um item, com `- [ ] ` um item de checklist que se marca com um clique. Fica neste computador — até 200 páginas, 20.000 caracteres por página.
- **O Claude também cuida dele.** *Passar ao Claude* entrega uma página ao Claude, ou simplesmente peça ao Claude para anotar algo no Arcade. O Claude usa a ferramenta `mcp__arcade__notes`, que só altera o caderno e não apaga nada. Se não gostar da edição do Claude: *Restaurar o texto de antes da edição do Claude*.
- **Notion e outros aplicativos** — pelos conectores do Claude, então o Arcade não precisa de chaves nem senhas: *Enviar para o Notion*, *Para outro aplicativo*, *Importar do Notion ou de outro aplicativo*. Uma página vinculada pode ser atualizada no aplicativo ou importada de novo de lá.
- **Voz.** Dite na caixa de mensagem do Claude com o ditado do próprio sistema (Win+H no Windows, Fn duas vezes no macOS) e pressione *Pegar da caixa de mensagem do Claude* — o texto vai para o fim da página.
- **Quadro de projetos.** Colunas — *A fazer*, *Fazendo*, *Feito* ou as suas, até 8 — e cartões; um cartão é uma página do caderno com texto e checklist. Pressione um cartão para escolhê-lo e movê-lo com as setas, pressione de novo para abri-lo. O Claude também pode cuidar de um quadro: *Passar ao Claude*, ou peça para ele distribuir tarefas num quadro do Arcade.
- **Quadros compartilhados.** Depois de entrar e com um @apelido, marque amigos e pressione *Compartilhar*: todos têm os mesmos cartões, colunas e nome, e as mudanças aparecem em segundos. O dono convida mais amigos, remove pessoas e exclui o quadro do site; qualquer um pode sair; aconteça o que acontecer, cada um fica com sua própria cópia. Até 3 quadros compartilhados seus, 20 pessoas e 200 cartões por quadro.

## Seus próprios jogos

- **`/arcade-add <arquivo>`** adiciona uma ROM de NES, Mega Drive ou Master System (até 4 MB). O plugin guarda uma cópia em `~/.claude/arcade` e nunca a envia para lugar nenhum.
- **Discos de PlayStation e WADs do Doom** (por exemplo, um `doom.wad` seu) — na janela do Arcade: **Abrir seu próprio arquivo**. Eles ficam só nesse navegador.

Adicione apenas arquivos sobre os quais você tem direitos.

## Configurações

Abra **Configurações** na seção *Mais* do menu `/arcade`:

- **Seções do menu principal** — mostrar ou ocultar qualquer seção, menos *Mais*; uma seção oculta some do menu por completo até você trazê-la de volta aqui. A mesma escolha aparece na primeira vez que você abre o Arcade.
- **Idioma** — um dos 13 (também direto no menu: 🌐).
- **Abrir jogos** — aqui no painel, em uma janela do navegador ou em um navegador específico; no Claude Desktop — no navegador integrado do Claude ou em uma janela do navegador.
- **Gráficos** (terminal) — pixels nos terminais que mostram imagens (kitty, Ghostty, Rio), blocos de texto em todos os outros.
- **Tamanho do painel** — normal ou largura total.
- **Quando o agente terminar** — aviso e continuar jogando, pausa com aviso, ou voltar direto ao agente.
- **Quando o agente pedir permissão** — as mesmas três opções.
- **Quando o navegador abrir** (Claude Desktop) — fechar o menu do Arcade para o navegador ocupar toda a altura, ou manter o menu acima dele.
- **O agente terminou enquanto você assiste** (Claude Desktop) — fechar a aba que o Arcade abriu para um vídeo, uma transmissão, o TikTok, um artigo ou um episódio, para a conversa com o Claude voltar à sua frente, ou só avisar você.
- **Notificações ao jogar em uma janela.**
- **Notificações de mensagens** — um cartão no canto inferior esquerdo quando um amigo escreve em uma conversa (no macOS e no Linux, uma notificação do sistema).
- **Teste de teclas e remapeamento** (terminal).
- **Termos e privacidade** — os Termos de uso e a Política de privacidade do site, no seu navegador de sempre.

## O que o plugin faz no seu computador

O Arcade roda dentro do Claude Code com o acesso que o Claude Code dá aos plugins. Todo o código está neste repositório, e `claude plugin validate ./mod` lista cada evento a que ele se conecta e cada chamada que faz. Em resumo:

- **As ferramentas do agente.** O Arcade vê quando uma ferramenta começa e termina e quando o agente pede permissão — é assim que sabe quando mostrar o aviso. Ele nunca altera nem bloqueia as chamadas de ferramentas do agente. Por conta própria, aprova só dois tipos de chamada, e só onde o Claude Code perguntaria a você: `mcp__arcade__notes`, que só altera o caderno e não apaga nada, e abrir um jogo no navegador integrado do Desktop depois que você o escolhe no painel. Suas regras de permitir e negar valem como estão.
- **Interromper o agente.** Só no Claude Desktop, quando você abre algo no navegador integrado enquanto o agente trabalha: o Desktop não deixa um plugin abrir o navegador sozinho. O Arcade espera a ferramenta atual terminar (depois de 10 segundos ele a corta, mas espera enquanto houver um pedido de permissão na tela), interrompe o agente e pede ao Claude que abra a página e volte ao trabalho. Para evitar isso, escolha uma janela do navegador em *Configurações → Abrir jogos*.
- **Sua conversa.** Para os temas, o Haiku na sua própria sessão recebe o final da conversa, alguns milhares de caracteres; isso conta no seu uso do Claude. O site do Arcade nunca vê a conversa. O Arcade escreve na caixa de mensagem ou a envia só quando você pede — por exemplo, *Passar ao Claude* no caderno — ou para abrir uma página como descrito acima.
- **Programas.** Seu navegador para a janela do Arcade (no Windows, com um perfil próprio em `%LOCALAPPDATA%\claude-arcade`); notificações — PowerShell no Windows, `osascript` no macOS, `notify-send` no Linux; uma verificação de quais navegadores estão instalados (Windows) ou de qual é o sistema (`uname`).
- **Arquivos.** Ele grava só as ROMs que você adiciona com `/arcade-add`, em `~/.claude/arcade/roms`, e lê só o arquivo que você indica, essas cópias e os próprios arquivos. Configurações, caderno e favoritos ficam no armazenamento de plugins do Claude Code.
- **Variáveis de ambiente.** Lê `HOME` ou `USERPROFILE`, `LANG`, `LC_ALL`, `LC_MESSAGES`, `LOCALAPPDATA` e `OS`, e não altera nenhuma.
- **Rede.** O próprio plugin só se comunica com o site do Arcade (`agent-arcade.fefaodessa.workers.dev`), com os feeds RSS dos canais do YouTube e com os feeds dos blogs e podcasts que mostra. As imagens do painel do Desktop, como os avatares da Twitch, carregam direto desses serviços. Jogos, livros e vídeos são carregados pela página que você abre no navegador.

## Privacidade

Os detalhes estão na [Política de privacidade](https://agent-arcade.fefaodessa.workers.dev/privacy) e nos [Termos de uso](https://agent-arcade.fefaodessa.workers.dev/terms) do site; no plugin, ficam em *Configurações → Termos e privacidade*. Em resumo:

- Sem anúncios, sem análises, sem rastreamento. Jogos que vinham com código de análise foram limpos (veja o `NOTICE` de cada jogo).
- Suas ROMs, WADs, livros e arquivos de áudio nunca saem do seu computador ou navegador.
- As listas de livros e audiolivros e os livros do Project Gutenberg passam pelo site do Arcade, que os busca no Project Gutenberg, no Wikisource e no archive.org e só os mantém no cache da Cloudflare — as listas por seis horas, um livro por uma semana. As páginas do Wikisource e as gravações do LibriVox a janela carrega direto desses sites.
- O jogo online passa pelo servidor do Arcade na Cloudflare: as mensagens são repassadas entre os jogadores de uma sala e não são guardadas — exceto as jogadas dos jogos de tabuleiro, mantidas para você poder voltar; uma partida parada por um mês é apagada.
- Os temas são sugeridos pelo Haiku na sua própria sessão do Claude Code; o site do Arcade nunca vê sua conversa — só uma curta consulta de busca em inglês quando você usa *Seu próprio tema*. O endereço de um artigo vai depois de `#`, então nunca chega ao servidor do Arcade.
- A busca por *Seu próprio tema* passa pelos YouTube API Services, e os vídeos tocam no próprio player do YouTube, então também valem os [Termos de Serviço do YouTube](https://www.youtube.com/t/terms) e a [Política de Privacidade do Google](https://policies.google.com/privacy). O Haiku, na sua própria sessão, escolhe até seis vídeos pelos títulos e descrições curtas; o site do Arcade guarda os resultados de busca num cache compartilhado por um dia.
- Depois de entrar, o site guarda suas configurações sincronizadas, favoritos, @apelido, amigos, conversas e quadros compartilhados, e os convites para jogar por 10 minutos. Quem está online ele mantém só na memória, por um minuto e meio. A chave de sessão só é enviada ao site do Arcade.
- O caderno fica no seu computador. Os quadros compartilhados ficam guardados no site do Arcade e não são criptografados, como as conversas. As páginas só vão para o Notion ou outro aplicativo quando você pede, pelos seus próprios conectores do Claude.
- Um relatório de erro contém seu texto, a versão do Arcade, onde ele está aberto, o idioma da interface e o sistema operacional — nada mais; sem login ele vai sem assinatura, e o site não guarda nenhum endereço.
- Alguns jogos só acessam a internet se você pedir — por exemplo, a pesquisa opcional do OpenTTD e seu botão *Online Content*.

## Plataformas e status

O Arcade está em **beta**: os recursos estão no lugar, e o trabalho continua nos detalhes — veja o [histórico de mudanças](CHANGELOG.md).

- Testado na prática no Windows, macOS e Linux.
- Funciona no terminal, no VS Code e no Claude Desktop.

## Licenças

- **Jogos:** cada jogo tem sua própria licença livre (MIT, GPL, BSD, Apache, Creative Commons e outras) — o texto da licença e o código-fonte ficam junto do jogo e têm link no cartão dele.
- **Livros e audiolivros:** domínio público; o Arcade não os guarda — os livros vêm do Project Gutenberg e do Wikisource, as gravações do LibriVox (archive.org), no momento em que você os abre.
- **Emuladores e motores:** JSNES (Apache-2.0), EmulatorJS (GPL-3.0) com seus núcleos, PrBoom (GPL-2.0), doom-wasm da Cloudflare e Chocolate Doom/Heretic (GPL-2.0), OpenTTD (GPL-2.0), micropolisJS (GPL-3.0 com termos adicionais), ScummVM (GPL-3.0-or-later), Stockfish (GPL-3.0) — o adversário no xadrez. O núcleo Genesis Plus GX usado para Sega e Master System é apenas para uso não comercial.
- **O código do próprio Arcade** (o plugin e o site) — **GNU AGPL-3.0** ([LICENSE](LICENSE)), © 2026 Max Arbakov. Você pode usá-lo, estudá-lo e modificá-lo livremente. Se você distribuir uma versão modificada — ou rodá-la como serviço online para outras pessoas —, precisa publicar todo o seu código-fonte sob a mesma licença e manter os avisos de direitos autorais. Componentes de terceiros mantêm suas próprias licenças.

## Apoie o projeto

O Arcade é gratuito. Se ele deixa suas esperas mais divertidas, você pode pagar um café para o projeto — totalmente opcional: **[ko-fi.com/agentarcade](https://ko-fi.com/agentarcade)**. O mesmo link está no fim do menu `/arcade` (*☕ Apoiar o projeto*) e na janela do Arcade. Nada no Arcade depende disso, e isso nunca interrompe um jogo.

## Feedback

Achou um erro? O jeito mais rápido é direto no Arcade: **Mais → 🐞 Relatar um erro**. Descreva o que quebrou, e o relatório vai direto para o autor do Arcade com a versão, o ambiente, o idioma e o sistema operacional.

Você também pode abrir uma [issue](https://github.com/ArbakovMaxim/agent-arcade/issues) — para erros e para ideias. Informe seu sistema operacional, seu ambiente do Claude Code (terminal, VS Code ou Desktop) e o jogo.

Pull requests são bem-vindos. Ao enviar um, você concorda que sua contribuição fica sob a AGPL-3.0 e que o autor também pode oferecer o Arcade sob outros termos (por exemplo, uma licença comercial).

## Para desenvolvedores

```
mod/     o plugin do Claude Code (hooks, interface do painel, testes)
site/    o site no Cloudflare Workers: catálogo, janela do Arcade, salas de rede, contas, amigos, conversas, relatórios de erro
tools/   ferramentas de build: traduções, heretic-wasm
.github/ GitHub Actions que compilam doom-wasm, heretic-wasm, OpenTTD e ScummVM para o navegador
```

- Rodar o plugin a partir do repositório: `claude --plugin-dir ./mod`
- Testes do plugin: `claude plugin validate ./mod`, depois `claude plugin test` dentro de `mod/`
- Testes do site: `npm test` dentro de `site/`; build: `node build.mjs`; o deploy é automático a partir da `main` pelo Cloudflare Workers Builds.
- O trabalho acontece na `main`, e os pull requests também vão para lá. A branch padrão `plugin` é uma cópia da `main` sem `site/`, atualizada por uma GitHub Action a cada push: o marketplace de plugins baixa essa branch em vez do repositório inteiro.
- Traduções: `node tools/i18n/collect.mjs`, depois `node tools/i18n/check.mjs` — veja [tools/i18n/README.md](tools/i18n/README.md).

Documentação detalhada (em russo): [mod/README.md](mod/README.md) — o plugin, [site/README.md](https://github.com/ArbakovMaxim/agent-arcade/tree/main/site/README.md) — o site, como adicionar jogos e o jogo em rede.
