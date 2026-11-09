<img src="docs/brand/arcade-logo-2-512.png" width="96" alt="Logo do Arcade" align="right">

# Arcade — quadros de tarefas, notas, conversas da equipe e jogos dentro do Claude Code

[English](README.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · **Português** · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [日本語](README.ja.md) · [中文](README.zh.md) · [한국어](README.ko.md)

> **Beta (0.39).** Tudo o que está descrito aqui funciona e é usado todos os dias; daqui em diante, mudam principalmente os detalhes. Relatos de erros são muito bem-vindos — veja [Feedback](#feedback).

O Arcade é um plugin para o [Claude Code](https://claude.com/claude-code) que o transforma num pequeno espaço de trabalho: quadros de projetos em que o Claude vai pegando os cartões um a um, até em várias sessões ao mesmo tempo; um caderno que o Claude mantém com você e que todas as suas sessões abertas compartilham; um calendário; e quadros e conversas compartilhados para a sua equipe. E para a espera: quando o agente fica ocupado por mais de 10 segundos, um pequeno *«jogar?»* aparece acima do prompt. Jogue alguma coisa — NES, Sega, PlayStation, Doom, xadrez e mais —, leia um livro, ouça um audiolivro ou um podcast, ou assista a um vídeo sobre o assunto em que o agente está trabalhando. O Arcade avisa assim que o agente termina ou precisa da sua permissão — você não perde nada.

Tudo no catálogo é gratuito: os jogos têm licenças abertas, os livros e audiolivros são de domínio público. Você também pode jogar online com outras pessoas que estão esperando seus agentes e conversar com seus amigos.

![Demonstração: um quadro de projetos no Claude Desktop; um cartão abre como página com um checklist, Passar ao Claude o entrega e o Claude marca cada item, escreve o resultado no cartão e o move para Feito](https://github.com/user-attachments/assets/c6519d8f-2bb5-4af2-9ebf-c4bfa5c144c6)

*Seu quadro: um cartão vai para o Claude com um botão, interface em inglês. [Ver o vídeo de 31 segundos](https://github.com/user-attachments/assets/c9076e68-2db6-4f68-9d88-8a132ce96f6a).*

![Demonstração: o Claude Code recebe uma tarefa, «jogar?» aparece acima do prompt, um jogo de NES roda ao lado do chat e o Arcade avisa você quando o agente termina; também há livros, audiolivros e artigos](https://github.com/user-attachments/assets/3d8f79ac-966f-4872-84d5-7aa91534330d)

*Enquanto o agente trabalha: 31 segundos no Claude Desktop, com a interface em inglês. [Ver o vídeo em 720p](https://github.com/user-attachments/assets/bbb14c28-2813-40c0-82e6-d7375ddc2253).*

## Recursos

- **Caderno e quadros de projetos.** Páginas, subpáginas e checklists que o Claude também mantém, e quadros com colunas e cartões. *Passar ao Claude* entrega uma página ou um cartão ao Claude: ele marca o que foi feito e escreve o resultado ali. Uma página ou cartão mostra o texto formatado, com os botões *Editar* e *Copiar*. Todas as suas sessões abertas do Claude Code compartilham o caderno, então cada uma pode pegar o seu próprio cartão do mesmo quadro. Compartilhe um quadro com amigos, e todos trabalham no mesmo. Envie uma página para o Notion ou outro aplicativo, ou traga uma de lá, pelos conectores do Claude; dite na caixa de mensagem do Claude e leve o texto para uma página.
- **O Claude trabalha no seu quadro.** *Fila para o Claude* entrega ao Claude os cartões da primeira coluna um por um: o próximo vai quando o anterior está em *Feito*, e uma pergunta do Claude ou um cartão inacabado interrompe a fila. Os cartões têm prazos que aparecem no calendário, e num quadro compartilhado todos veem quem pegou cada cartão. Traga issues do GitHub, Linear, Jira ou outro tracker para um quadro como cartões e publique o resultado de volta como comentário, pelos conectores do Claude. *Resumo do dia* monta uma página de stand-up — o que foi passado ao Claude, o que está feito, o que está em andamento — para enviar à conversa da sua equipe.
- **Prompts.** Pedidos que você digita repetidamente viram modelos de um clique: um clique manda um deles para o Claude, como *Passar ao Claude*, e *Para a caixa de mensagem* deixa você completá-lo antes. Compartilhe um conjunto com amigos, e a equipe toda tem os mesmos prompts. O Claude também salva modelos: «salve isto como prompt no Arcade».
- **Hoje.** O primeiro bloco de *Trabalho* reúne numa tela o que está esperando por você: sessões esperando uma permissão ou uma resposta (uma pergunta com opções se responde ali mesmo), os eventos de hoje, os cartões com prazo hoje ou atrasados, os cartões que você pegou em quadros compartilhados, as conversas não lidas e uma linha com os limites do Claude.
- **Agentes.** *Agentes*, na seção *Trabalho*, mostra cada sessão do Claude Code com o Arcade neste computador, por pasta: se está trabalhando, aguardando permissão, se terminou o turno ou está livre, e há quanto tempo, com o seu cartão e o lugar na fila. Quando o Claude em outra sessão faz uma pergunta com opções, você responde com um botão direto no cartão dela. Quando outra sessão pede permissão ou faz uma pergunta, aparece um aviso no seu próprio painel. A fila de um quadro pode rodar em várias sessões ao mesmo tempo, e duas sessões não pegam o mesmo cartão. Cada cartão também mostra a branch do git e os arquivos sem commit da sessão, e avisa quando duas sessões editam o mesmo arquivo.
- **Limites.** O bloco *Limites*, na seção *Trabalho*, mostra as janelas de limite do Claude — 5 horas, a semana e o limite de gastos — com porcentagem, barra e quando cada uma reinicia, além do contexto e do custo desta e das suas outras sessões. Os números vêm do próprio Claude Code. Se um limite acabar no meio da fila de um quadro, um botão a continua depois do reinício.
- **Calendário.** No Desktop, um mês de quadradinhos de dia do mesmo tamanho, com um ponto na cor de cada evento; no terminal e no VS Code, a lista do que vem por aí. Um evento entra com uma linha, como «fri 9:30 standup», e pode se repetir todos os dias, nos dias úteis, toda semana, todo mês ou todo ano. Escolha a cor e quando ser lembrado, de uma lista ou com suas palavras (como «45 min before» ou «the day before at 20:00»); o lembrete chega como notificação do sistema. Os prazos dos cartões dos quadros também aparecem ali. O Claude também anota e altera eventos: «anota uma ligação na sexta às 15:00». Na hora de um evento, o Arcade pode passar uma tarefa ao Claude: a fila de um quadro, um cartão, um modelo ou o seu próprio texto.
- **Amigos e conversas.** Um login opcional com o GitHub mantém suas configurações iguais em todos os seus computadores e dá a você um @apelido; adicione amigos pelo apelido exato, veja quem está online, compartilhe quadros, convide-os para jogar e converse a dois ou em grupos.
- **Sabe o que o agente está fazendo.** Quando o agente termina ou pede permissão, um aviso aparece sobre o jogo — continue jogando, pause ou volte direto ao agente (você escolhe o comportamento nas configurações). No Claude Desktop ele também pode fechar a aba que você está assistindo, para a conversa voltar à sua frente.
- **Aparece sozinho.** Depois de 10 segundos de trabalho do agente, o Arcade oferece um jogo acima do prompt — ou mais tarde, ou nunca, como você escolher nas configurações; ele nunca toma o foco a menos que você peça.
- **Acompanha você entre sessões.** Deixe o painel do Arcade aberto, e cada nova sessão do Claude Code o abre sozinha; feche-o manualmente, e ele continua fechado.
- **Um menu, seis seções.** *Jogar*, *Ler e ouvir*, *Assistir*, *Social*, *Trabalho* e *Mais* — recolha as que você não precisa. No topo: *Continuar* o último jogo, *Buscar* e *Favoritos*. Na primeira vez que você abre o Arcade, escolhe quais seções mostrar.
- **61 jogos gratuitos** para NES (Dendy), Sega Mega Drive, Master System, PlayStation e uma aba *Jogos* com jogos de arcade, tiro, corrida, estratégia, aventuras e jogos de tabuleiro.
- **Ler e ouvir.** Clássicos e audiolivros do LibriVox em 30 idiomas, direto do Project Gutenberg, do Wikisource e do LibriVox, além de artigos e episódios recentes de podcasts sobre o assunto do trabalho do agente.
- **Assistir.** Vídeos recentes do YouTube sobre o assunto do trabalho do agente, Twitch: seus próprios canais e transmissões ao vivo sobre programação, tecnologia, ciência e jogos retrô, e TikTok: o feed *Para você* e a busca no próprio site do TikTok, onde você entra por conta própria.
- **NES e Flappy Arcade direto no Claude Code** — no terminal, no VS Code e no Claude Desktop. Todo o resto abre em uma janela do navegador; no Claude Desktop, por padrão, no navegador integrado do Claude (os jogos de tiro ainda abrem em uma janela do navegador: o navegador integrado não consegue capturar o mouse).
- **Jogo online.** Jogos de console para dois pela rede, deathmatch e cooperativo no Doom, xadrez, go, damas e reversi contra pessoas ou contra o computador.
- **«Quem está esperando online».** O Arcade mostra no Claude Code quando alguém está esperando um parceiro, com um botão *Entrar*.
- **Busca e favoritos.** Uma única busca em jogos e canais da Twitch, agrupada por seção e gênero; marque um jogo com ☆ para guardá-lo em *★ Favoritos*.
- **Seus próprios jogos.** Adicione ROMs que você possui; elas ficam no seu computador.
- **13 idiomas de interface:** English, Русский, Українська, Español, Français, Deutsch, Português, Italiano, Polski, Türkçe, 日本語, 中文, 한국어 — pelo idioma do sistema ou do navegador, inglês por padrão.

## Instalação

Requer o **Claude Code 2.1.275 ou mais recente**. *Limites* precisa de um Claude Code que informe os limites aos plugins (verificado no 2.1.302 e no 2.1.316); num mais antigo, essa tela avisa isso, e o resto do Arcade funciona normalmente.

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
- Deixe o painel aberto, e as novas sessões o abrem sozinhas: no terminal, ao iniciar; no Desktop e no VS Code, quando se conectam à sessão; o teclado continua no prompt. Feche-o manualmente (o X de fechar ou Esc), e ele para de abrir sozinho até você abri-lo de novo.
- Quando o agente trabalha por mais de 10 segundos, *«jogar?»* aparece acima do prompt: **`1`** — jogar aqui, no painel; **`2`** — em uma janela do navegador (onde houver); **`3`** — agora não, e depois você escolhe por quanto tempo não perguntar: 5 ou 10 minutos, até o Claude reiniciar (em todas as sessões deste computador) ou só desta vez. Em Configurações → Notificações você escolhe quando ele aparece — de 10 segundos a 5 minutos — ou o desativa.
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
| **Trabalho** | Hoje, Caderno, Quadro de projetos, Prompts, Calendário, Agentes, Limites |
| **Mais** | Janela do Arcade, Configurações, 🌐 idioma, 🐞 Relatar um erro, ☕ Apoiar o projeto |

Clique no título de uma seção para recolhê-la ou expandi-la. Uma seção recolhida mostra `▸` e quantos blocos ela contém, e *Social* também mostra novas mensagens 💬 e pedidos de amizade 👥. O Arcade lembra quais seções estão recolhidas. Uma seção de que você não precisa pode ser ocultada em **Configurações**: ela some do menu por completo, com título e blocos; *Mais*, com as configurações, fica sempre. Depois de entrar, o cabeçalho do menu mostra seu @apelido com os mesmos contadores.

A **busca** começa a partir de duas letras e encontra título ou gênero, sem diferenciar maiúsculas nem acentos. Os resultados são agrupados por seção e gênero, por exemplo *Jogos · Tiro*. A estrela ☆ ao lado de um jogo o adiciona a **★ Favoritos** (até 100), organizados por seção e gênero, os mais recentes primeiro. Livros e audiolivros têm busca própria, por título ou autor.

### Onde cada coisa abre

| | NES (Dendy), Flappy Arcade | Sega, Master System, PlayStation, outros Jogos; livros, audiolivros, artigos, podcasts, vídeos |
|---|---|---|
| **Terminal** | no painel (gráficos em pixels onde o terminal suporta, senão blocos de texto) | janela do navegador |
| **VS Code** | no painel | janela do navegador |
| **Claude Desktop** | no painel | navegador integrado do Claude ou janela do navegador (escolha nas configurações); jogos de tiro — sempre uma janela do navegador |

A janela do navegador é uma janela separada do Arcade (no seu navegador padrão ou no escolhido nas configurações), não uma aba entre as suas. As conversas funcionam direto no painel — no terminal e no Desktop; *Abrir como página* as abre do mesmo jeito no site. O caderno, os quadros de projetos, o calendário e os agentes ficam no painel. O TikTok abre no navegador integrado do Claude no Desktop e, nos outros lugares, no seu navegador padrão, onde você provavelmente já entrou na conta.

## Caderno e quadros de projetos

Os dois ficam na seção *Trabalho* do menu.

- **Caderno.** Páginas e subpáginas; uma linha que começa com `# ` é um título, com `- ` um item, com `- [ ] ` um item de checklist que se marca com um clique. Fica neste computador — até 200 páginas, 20.000 caracteres por página.
- **Editar e Copiar.** Uma página ou cartão mostra o texto formatado — títulos, listas, checklist — no Desktop e no VS Code, e como linhas no terminal. *Editar* abre a caixa de texto no lugar dele: Enter salva, *Cancelar* descarta a mudança, e o que o Claude ou outra sessão alterar nesse meio-tempo aparece na caixa. *Copiar* coloca a página inteira na área de transferência — no painel do Desktop só dá para selecionar texto dentro das caixas de entrada, então este é o jeito de copiar uma página.
- **O Claude também cuida dele.** *Passar ao Claude* entrega uma página ao Claude, ou simplesmente peça ao Claude para anotar algo no Arcade. O Claude usa a ferramenta `mcp__arcade__notes`, que só altera o caderno e não apaga nada. Se não gostar da edição do Claude: *Restaurar o texto de antes da edição do Claude*.
- **Notion e outros aplicativos** — pelos conectores do Claude, então o Arcade não precisa de chaves nem senhas: *Enviar para o Notion*, *Para outro aplicativo*, *Importar do Notion ou de outro aplicativo*. Uma página vinculada pode ser atualizada no aplicativo ou importada de novo de lá.
- **Voz.** Dite na caixa de mensagem do Claude com o ditado do próprio sistema (Win+H no Windows, Fn duas vezes no macOS) e pressione *Pegar da caixa de mensagem do Claude* — o texto vai para o fim da página.
- **Quadro de projetos.** Colunas — *A fazer*, *Fazendo*, *Feito* ou as suas, até 8 — e cartões; um cartão é uma página do caderno com texto e checklist. Pressione um cartão para escolhê-lo e movê-lo com as setas, pressione de novo para abri-lo. O Claude também pode cuidar de um quadro: *Passar ao Claude*, ou peça para ele distribuir tarefas num quadro do Arcade.
- **Quadros compartilhados.** Depois de entrar e com um @apelido, marque amigos e pressione *Compartilhar*: todos têm os mesmos cartões, colunas e nome, e as mudanças aparecem em segundos. O dono convida mais amigos, remove pessoas e exclui o quadro do site; qualquer um pode sair; aconteça o que acontecer, cada um fica com sua própria cópia. Até 3 quadros compartilhados seus, 20 pessoas e 200 cartões por quadro.
- **Várias sessões ao mesmo tempo.** Todas as sessões abertas do Claude Code neste computador compartilham um mesmo caderno e seus quadros: o que uma sessão adiciona, altera ou marca, as outras veem em poucos segundos, e assim cada sessão pode cuidar do seu próprio cartão do mesmo quadro.
- **Fila para o Claude.** Num quadro, *Fila para o Claude* entrega ao Claude o primeiro cartão da primeira coluna e o move para a segunda coluna se o quadro tiver mais de duas. Quando o Claude termina o turno com esse cartão na última coluna, o próximo cartão vai sozinho, até 10 cartões por rodada. A fila para quando o Claude faz uma pergunta, o turno é interrompido ou termina com erro, o cartão não está na última coluna, ou você manda outra coisa ao Claude — daí em diante, quem decide é você. Um pedido de permissão não a interrompe: se for aprovado — por você ou pelo modo automático — e o cartão estiver na última coluna, o próximo vai. *Parar a fila* deixa o Claude terminar o cartão atual sem lhe passar o próximo. Num quadro compartilhado, os cartões que outra pessoa pegou são pulados. Uma fila pode rodar em várias sessões ao mesmo tempo — veja [Agentes](#agentes). Se o limite do Claude acabar no meio de uma fila, ela pode continuar depois do reinício — veja [Limites](#limites).
- **Verificação entre cartões.** Na tela de um quadro, *Verificação entre cartões* recebe um comando como `npm test`; um cartão pode ter o seu em *Verificação própria*. Quando o Claude termina um turno com o cartão na última coluna, a fila roda o comando na pasta da sessão (por até 10 minutos) antes de entregar o próximo cartão. Código de saída 0 — o próximo cartão vai. Caso contrário, a fila para, o cartão volta para a segunda coluna com a marca *A verificação falhou*, e o Claude recebe o fim da saída para corrigir e mover o cartão de novo; inicie a fila outra vez e o Arcade verifica esse cartão primeiro. O resultado aparece no quadro e no *Resumo do dia*. Se a fila roda em várias sessões, quem roda a verificação é a sessão que fez o cartão. O comando roda sem pedido de permissão, como um hook do Claude Code, e fica guardado só neste computador — nem no caderno nem num quadro compartilhado —, e nem o Claude nem os membros do quadro podem mudá-lo. Sem comando, a fila funciona como antes.
- **Prazos.** O campo *Prazo* de um cartão aceita «fri», «tomorrow», «20.11» ou «2026-11-20». A data aparece embaixo do cartão no quadro — numa cor de alerta quando já passou e o cartão não está feito — e no calendário, que lembra você às 9:00 desse dia, a menos que o cartão já esteja na última coluna. O Claude também define prazos.
- **Quem pegou um cartão.** Num quadro compartilhado, *Passar ao Claude* marca o cartão como seu, e todos veem «nas mãos de @apelido» embaixo dele. Se outra pessoa o pegou, o Arcade avisa primeiro; pressione de novo para passá-lo ao seu Claude mesmo assim. *Liberar o cartão* o deixa livre.
- **Issues de um tracker.** Num quadro, escolha o tracker — GitHub, Linear, Jira ou *Outro tracker* — e diga de onde trazer as issues: `owner/repo`, a chave de um time ou projeto, ou um link. O Claude lê até 20 issues abertas pelo conector desse tracker e adiciona como cartões as que ainda não estão no quadro. Num cartão assim, *Resultado para* com o nome do tracker faz o Claude publicar na issue um comentário curto sobre o que foi feito; ele não fecha a issue nem muda o status dela. O próprio Arcade nunca fala com os trackers e não guarda chaves: tudo passa pelos conectores que você adicionou no Claude — GitHub, Linear, Atlassian para o Jira, Asana, ClickUp, monday.com e outros. Sem o conector, o Claude avisa e explica onde adicioná-lo.
- **Resumo do dia.** O botão embaixo dos quadros e no caderno cria uma página «Resumo DD.MM»: o que foi passado ao Claude hoje, o que está feito — cartões movidos para a última coluna, itens marcados — e o que ainda está em andamento. Passe-a ao Claude, edite-a ou envie-a para uma conversa.
- **Enviar para uma conversa.** Depois de entrar, *Enviar para uma conversa* publica qualquer página como texto numa das suas conversas recentes, mantendo os títulos e as marcas da checklist.

## Prompts

Um bloco da seção *Trabalho* do menu: seus próprios modelos de prompt, cada um enviado ao Claude com um clique.

- **Modelos.** Um modelo é um nome num botão e o texto que vai para o Claude. Digite um nome em *Novo modelo*, depois o texto; Enter salva. Os modelos ficam em conjuntos: o primeiro vai para *Meus prompts*, e *Novo conjunto* cria outro. Um modelo pode ser renomeado, editado, movido com *↑ Acima* e *↓ Abaixo* e excluído com um segundo clique.
- **Um clique.** Pressionar um modelo envia o texto dele ao Claude como está, como *Passar ao Claude*: na hora, se o Claude estiver livre; se estiver ocupado, o modelo aguarda na caixa de mensagem até você enviá-lo. *Para a caixa de mensagem* o adiciona ao que você já digitou ali, sem enviar, para você completá-lo. Embaixo de cada modelo aparece a primeira linha do texto dele; ✎ o abre para edição.
- **O Claude também salva.** Diga «salve isto como prompt no Arcade», e o Claude adiciona um modelo pela ferramenta `mcp__arcade__notes`.
- **Conjuntos compartilhados.** Depois de entrar e com um @apelido, abra *Configurações do conjunto*, marque amigos e pressione *Compartilhar*: todos têm os mesmos modelos e o mesmo nome, e as mudanças aparecem em segundos. Os conjuntos compartilhados dos amigos aparecem sozinhos nos seus *Prompts*. Como nos [quadros compartilhados](#caderno-e-quadros-de-projetos), o dono convida e remove pessoas, qualquer um pode sair, e cada um fica com sua própria cópia. Os conjuntos compartilhados contam entre os seus 3 quadros compartilhados.
- **Não são comandos.** Os modelos são botões do painel do Arcade, não comandos do Claude Code: os comandos de barra e as skills funcionam como antes. Os modelos ficam neste computador junto com o caderno e contam nas 200 páginas dele.

## Calendário

Fica na seção *Trabalho* do menu. Como o caderno, o calendário fica neste computador, no armazenamento de plugins do Claude Code, e todas as suas sessões abertas o compartilham.

- **Mês e dia.** No Desktop, uma grade do mês com quadradinhos de dia do mesmo tamanho, setas e *Hoje*: em cima a data, embaixo um ponto na cor de cada evento (até três, depois «+N»). O dia escolhido tem a moldura destacada, e hoje, um fundo colorido. Abaixo da grade ficam os eventos do dia escolhido e depois *Próximos* para os 30 dias seguintes, como cartões na cor de cada evento. No terminal e no VS Code é a lista *Próximos*.
- **Uma linha cria um evento:** «fri 9:30 standup», «tomorrow 15:00 call», «12.11 review», «2026-11-20 10:00 demo». Sem dia, vai para o dia escolhido na grade (no terminal, hoje); sem hora, é o dia inteiro. As palavras para os dias são entendidas em inglês e em russo.
- **Repetir.** Não se repete, todos os dias, dias úteis, toda semana, todo mês ou todo ano; o dia do evento é quando a série começa. Uma linha também pode dizer isso: «every friday 10:00 retro», «on weekdays 9:30 standup».
- **Cor.** Azul, verde, amarelo, laranja, vermelho, roxo, rosa ou cinza; azul por padrão.
- **Lembrete.** Escolha numa lista: no início, 5, 10, 15 ou 30 minutos, 1 ou 2 horas, um dia, dois dias ou uma semana antes; num evento de dia inteiro, às 9:00, 8:00 ou 7:00 do dia, na véspera às 21:00, 18:00 ou 9:00, dois dias ou uma semana antes às 9:00. Ou escreva o seu próprio horário, em inglês ou em russo: «45 min before», «at 14:30», «the day before at 20:00» — não depois do início e não mais de uma semana antes. No app do Claude no celular, que não tem lista, um botão vai passando pelas opções.
- **Notificações.** O lembrete chega como notificação do sistema e como aviso rápido enquanto alguma sessão do Claude Code estiver aberta; uma sessão o mostra, não todas. Um lembrete perdido com o Claude Code fechado aparece na próxima abertura como *Perdido*, se o evento foi há menos de um dia.
- **O Claude também cuida dele**, com a ferramenta `mcp__arcade__calendar`, que só altera o calendário: «anota uma ligação na sexta às 15:00», «o que eu tenho amanhã?», «deixa a demo vermelha».
- **Prazos dos cartões.** Os cartões dos quadros com prazo aparecem no seu dia como eventos de dia inteiro, *feito* quando o cartão está na última coluna; o prazo se altera no próprio cartão.
- **Agendado: uma tarefa para o Claude.** Num evento, *Passar ao Claude* escolhe o que o Claude recebe na hora do evento: a fila de um quadro, um cartão, um modelo de [Prompts](#prompts) ou o seu próprio texto; num evento de dia inteiro, às 9:00. A repetição funciona como de costume. O Claude também pode configurar isso: «todo dia útil às 9:00, passa ao Claude a fila do quadro Lançamento».
- **Onde roda.** O evento lembra a pasta em que foi configurado; a tarefa vai para uma sessão aberta do Claude Code nessa pasta, só para uma. Se o Claude estiver ocupado, a tarefa espera o fim do turno. *Executar nesta pasta* a passa para a pasta da sessão atual.
- **Tarefas perdidas.** Se nenhuma sessão estava aberta nessa pasta — o Claude Code estava fechado ou o computador em repouso —, a tarefa não roda atrasada sozinha: aparece um aviso rápido e, no topo do calendário, *Perdido* com *Executar agora* e *Não executar*. Uma tarefa perdida há mais de um dia é pulada em silêncio.
- **O que não é prometido.** Só funciona enquanto o Claude Code estiver aberto e o computador não estiver em repouso; o Arcade não acorda o computador nem abre o Claude Code. A tarefa roda no modo de permissões atual da sessão, e o Arcade não dá novos direitos: fora do Auto, o Claude pode esperar a sua permissão.
- **Ao lado de outros agendadores.** O Claude Code tem os seus: `/loop` repete um prompt na sessão atual, as tarefas agendadas do Desktop iniciam uma sessão por temporizador, e as tarefas agendadas na nuvem rodam mesmo com o seu computador desligado. O agendamento do Arcade gira em torno dos seus quadros e do seu calendário: as tarefas ficam na grade do mês ao lado dos seus eventos, vão para uma sessão já aberta na pasta do projeto e funcionam igual no terminal, no VS Code e no Desktop.
- Ele ainda não sincroniza com os calendários do Google ou da Apple.

## Agentes

Fica na seção *Trabalho* do menu: as sessões do Claude Code com o Arcade neste computador, cada uma com o nome da sua pasta, e a sua marcada como *esta sessão*.

- **O que cada uma está fazendo.** *Aguarda permissão*, *aguardando resposta*, *terminou o turno*, *trabalhando* ou *livre*, e há quanto tempo, com o cartão em que está e o lugar na fila, como *Fila: cartão 3 de 10*. As sessões que aguardam permissão vêm primeiro. No Desktop, cada sessão é um cartão; no terminal e no VS Code, uma linha. Uma sessão fechada some em menos de um minuto.
- **Encontre-a pela pasta.** O Arcade não consegue abrir outra sessão por você; o nome da pasta diz qual janela ou aba é.
- **Responda daqui.** Quando o Claude em outra sessão faz uma pergunta com opções, o cartão dela mostra a pergunta e as opções como botões. Uma pergunta única é enviada no primeiro clique; se houver várias, escolha as opções e clique em *Responder*. Em um segundo, o Claude naquela sessão recebe a resposta como se você a tivesse dado lá. Um pedido de permissão também aparece, com a ferramenta e o comando, como *Bash: npm test*, mas a permissão só é dada na própria sessão.
- **Uma fila, várias sessões.** Pressione *Fila para o Claude* no mesmo quadro em cada sessão, e a que estiver livre pega o próximo cartão; duas sessões não pegam o mesmo cartão. Uma sessão que entra avisa: *Já há uma fila em andamento neste quadro na sessão “api”*. Cada sessão para a sua própria fila pelas mesmas regras — uma pergunta do Claude, um cartão inacabado, um turno interrompido, outra coisa enviada ao Claude — e passa até 10 cartões por rodada. *Parar a fila* para só esta sessão; *Parar em todas* para todas, e cada uma termina o cartão atual. Embaixo de um cartão, o quadro mostra quem está com ele: *na sessão “api”*.
- **Mesma pasta.** Se uma sessão que já está na fila trabalha na mesma pasta, o Arcade avisa que as duas podem editar os mesmos arquivos, e a sessão só entra na fila quando você pressiona *Fila para o Claude* de novo. Uma pasta separada ou um git worktree é mais seguro.
- **O que mudou.** Numa pasta com git, o cartão de uma sessão tem uma linha como *branch landing · arquivos alterados: 4 · sem commit*, e *commits não enviados: 2* se houver; clique nela para ver os arquivos com as linhas adicionadas e removidas. Quando duas sessões alteram o mesmo arquivo, os dois cartões dizem isso — *app.js também é editado pela sessão “api”*; sessões na mesma pasta compartilham as alterações, e o Arcade avisa que não dá para saber de quem são. O seu próprio cartão tem *Passar ao Claude: revisar as alterações*: o Claude revisa as alterações sem commit e diz o que vale a pena corrigir, sem fazer commit, reverter nem guardar nada no stash. As alterações de outras sessões são só mostradas. Cada sessão lê o git na própria pasta ao iniciar e no fim de cada turno — só leitura, sem timer e sem rede.
- **Avisos.** Quando outra sessão pede permissão ou faz uma pergunta, um aviso no seu próprio painel do Arcade diz *A sessão “api” aguarda permissão* ou *…aguarda resposta a uma pergunta* — sem som, sem notificação do sistema. Desative-o, ou ative um aviso para turno terminado (desativado por padrão), em *Configurações → Notificações*.
- **Ocultar uma.** O × ao lado de outra sessão a oculta, junto com os avisos dela, até você trazê-la de volta em *Sessões ocultas*, embaixo; uma sessão oculta que aguarda permissão ou resposta mostra isso ali. As sessões ocultas valem em todas as sessões.
- **Fica neste computador.** Cada sessão mantém um pequeno arquivo em `~/.claude/arcade/agents` com a sua pasta, estado e cartão, a pergunta ou o pedido de permissão que ela aguarda, e o seu contexto, custo e janelas de limite para [Limites](#limites); uma resposta vinda de *Agentes* chega à sessão como um pequeno arquivo ao lado. Numa pasta com git, ele guarda também a branch e os nomes dos arquivos alterados com o número de linhas. Nada vai para o site do Arcade.

## Limites

Fica na seção *Trabalho* do menu. Os números vêm do próprio Claude Code, os mesmos que a linha de status mostra: o Arcade não conta nada por conta própria.

- **Janelas de limite.** 5 horas, a semana e o limite de gastos — porcentagem, barra e hora do reinício: «reinicia às 14:30 (em 1 h 20 min)». A barra é azul, amarela a partir de 80% e vermelha quando o limite acaba. As janelas são da conta e valem para todas as sessões dela, então a tela mostra a medição mais recente de todas as sessões deste computador e há quantos minutos ela foi feita.
- **Quando não há janelas.** Antes da primeira resposta do Claude, a tela avisa: *Aparece depois da primeira resposta do Claude.* Com uma chave de API ou por um gateway não há janelas — só contexto e custo: as janelas de 5 horas e semanal vêm com as assinaturas do Claude (Pro, Max, Team, Enterprise).
- **Esta sessão e as outras.** Quanto do contexto está ocupado, em porcentagem e em tokens, e o custo desde o início da sessão; abaixo, o contexto e o custo das outras sessões deste computador. Os mesmos números aparecem nos cartões delas em [Agentes](#agentes).
- **A fila depois do reinício.** Se o turno do Claude for interrompido no meio da [fila de um quadro](#caderno-e-quadros-de-projetos) e o Claude Code mostrar uma janela em 100%, a fila para e diz quando o limite reinicia. *Continuar a fila após o reinício às 14:31* a continua do mesmo cartão um minuto depois do reinício; enquanto ela espera — *A fila “Lançamento” continua às 14:31* e *Não continuar*. Você pode marcar um quadro com antecedência, e aí a fila dele continua sozinha, sem botão.
- **Só com o Claude Code aberto.** Só uma sessão aberta, num computador que não esteja em repouso, consegue continuar a fila. Se o Claude Code estava fechado ou o computador em repouso, *Limites* avisa: *A fila “Lançamento” não continuou depois que o limite reiniciou: o Claude Code estava fechado ou o computador em repouso*; se a sessão que esperava foi fechada — *…não começou depois que o limite reiniciou: a sessão estava fechada*. O × remove a mensagem.
- **Um aviso em 80 e 90%.** Quando uma janela chega a 80%, e depois a 90%, um aviso aparece no painel do Arcade — uma vez por limiar em todas as sessões. Desative-o em *Configurações → Notificações*.
- **Qual Claude Code.** Nem toda versão do Claude Code informa os limites aos plugins — verificado no 2.1.302 e no 2.1.316. Se a sua não informa, a tela avisa isso, e o resto do Arcade funciona normalmente.

## Hoje

O primeiro bloco da seção *Trabalho* do menu: o que está esperando por você, de todo o Arcade, numa só tela. Não guarda nada próprio: tudo vem do que o Arcade já sabe.

- **Esperando por você.** As sessões deste computador que esperam uma permissão ou uma resposta, a que espera há mais tempo no topo, como em [Agentes](#agentes). Uma pergunta com opções se responde aqui mesmo com um botão; a permissão só se dá na própria sessão.
- **No calendário.** Os eventos de hoje; os que já passaram ficam mais apagados. Pressionar um abre o evento no [calendário](#calendário).
- **Prazo.** Os cartões dos quadros com prazo hoje ou atrasados que ainda não estão na última coluna, com o nome do quadro; pressionar um abre o cartão.
- **Meus cartões.** Os cartões que você pegou em quadros compartilhados e que ainda não estão feitos.
- **Conversas.** As conversas não lidas, se você entrou; pressionar uma abre a conversa.
- **Limites.** Uma linha de [Limites](#limites), por exemplo *5 horas: 62%, reinicia às 14:30*; amarela a partir de 80%.

Os blocos vazios ficam ocultos; quando nada espera, a tela diz *Nada pendente para hoje.* No Desktop as sessões são cartões; no terminal e no VS Code tudo são linhas.

## Para equipes

Uma equipe pequena pode manter suas tarefas no Arcade: um quadro compartilhado, e quem pega um cartão o passa para o seu próprio Claude.

1. Todos instalam o Arcade (Claude Code 2.1.275 ou mais recente) — veja [Instalação](#instalação).
2. `/arcade` → **Social** → **Entrar com o GitHub**: a página do GitHub abre no seu navegador; confirme lá e depois clique em *Sign in* na página do Arcade (o código dela deve ser o mesmo do painel). Se não der certo, *Entrar com um código*.
3. Escolha um @apelido — seu nome do GitHub com um clique, ou outro inventado por você.
4. Adicionem-se como amigos pelo @apelido exato; a outra pessoa aceita.
5. **Trabalho** → crie um quadro → marque os colegas → **Compartilhar**.
6. Só quer os quadros e as conversas? Na primeira vez que abrir o Arcade, deixe só **Trabalho** e **Social**. Depois, em **Configurações → Notificações**, pressione **Linha “Jogar?”** até aparecer *desativada*: nada vai aparecer acima do prompt enquanto o agente trabalha.

A partir daí: abra o quadro, escolha um cartão, **Passar ao Claude**. Se o Claude estiver livre, o cartão vai para ele na hora; se estiver ocupado, o cartão espera na caixa de mensagem até você enviá-lo. O Claude marca o que foi feito e escreve o resultado no cartão, e todos no quadro veem isso em segundos — e também quem pegou cada cartão. Dê um prazo a cada cartão, e ele aparece no seu calendário. No fim do dia, *Resumo do dia* → *Enviar para uma conversa* leva o seu stand-up para a conversa da equipe. As conversas ficam em **Social**.

Você mesmo usa várias sessões do Claude Code? Pressione *Fila para o Claude* no mesmo quadro em cada uma: uma sessão livre pega o próximo cartão, e **Trabalho** → **Agentes** mostra o que cada sessão está fazendo.

Bom saber: quadros compartilhados e conversas ficam guardados no site do Arcade e não são criptografados, então não coloque senhas nem chaves neles. O Arcade só fica sabendo o nome e a imagem do seu perfil do GitHub. Até 3 quadros compartilhados seus, 20 pessoas e 200 cartões por quadro. *Excluir conta* (pressione duas vezes) faz o site esquecer você e suas configurações.

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
- **Outra sessão aguarda permissão** e **Outra sessão terminou o turno** — um aviso no painel do Arcade sobre as outras sessões deste computador, sem som (veja [Agentes](#agentes)); o primeiro também avisa de uma pergunta e vem ativado por padrão, o segundo desativado.
- **Limite do Claude em 80 e 90%** — um aviso no painel do Arcade quando uma janela de limite chega a 80% e a 90% (veja [Limites](#limites)); ativado por padrão.
- **Teste de teclas e remapeamento** (terminal).
- **Termos e privacidade** — os Termos de uso e a Política de privacidade do site, no seu navegador de sempre.

## O que o plugin faz no seu computador

O Arcade roda dentro do Claude Code com o acesso que o Claude Code dá aos plugins. Todo o código está neste repositório, e `claude plugin validate ./mod` lista cada evento a que ele se conecta e cada chamada que faz. Em resumo:

- **As ferramentas do agente.** O Arcade vê quando uma ferramenta começa e termina e quando o agente pede permissão — é assim que sabe quando mostrar o aviso. Ele nunca altera nem bloqueia as chamadas de ferramentas do agente. Por conta própria, aprova só três tipos de chamada, e só onde o Claude Code perguntaria a você: `mcp__arcade__notes`, que só altera o caderno e não apaga nada; `mcp__arcade__calendar`, que só altera o calendário; e abrir um jogo no navegador integrado do Desktop depois que você o escolhe no painel. Suas regras de permitir e negar valem como estão.
- **Interromper o agente.** Só no Claude Desktop, quando você abre algo no navegador integrado enquanto o agente trabalha: o Desktop não deixa um plugin abrir o navegador sozinho. O Arcade espera a ferramenta atual terminar (depois de 10 segundos ele a corta, mas espera enquanto houver um pedido de permissão na tela), interrompe o agente e pede ao Claude que abra a página e volte ao trabalho. Para evitar isso, escolha uma janela do navegador em *Configurações → Abrir jogos*.
- **Sua conversa.** Para os temas, o Haiku na sua própria sessão recebe o final da conversa, alguns milhares de caracteres; isso conta no seu uso do Claude. O site do Arcade nunca vê a conversa. O Arcade escreve na caixa de mensagem ou a envia só quando você pede — por exemplo, *Passar ao Claude* no caderno, o próximo cartão de uma *Fila para o Claude* que você iniciou, ou a tarefa de um evento com *Passar ao Claude*, na hora dele — ou para abrir uma página como descrito acima.
- **Limites.** Depois de cada turno e a cada meio minuto, o Arcade pede ao Claude Code a medição dele de limites, contexto e custo — o que a linha de status mostra. Isso não custa nada e não conta no seu uso do Claude.
- **Programas.** Seu navegador para a janela do Arcade (no Windows, com um perfil próprio em `%LOCALAPPDATA%\claude-arcade`); notificações, entre elas os lembretes do calendário — PowerShell no Windows, `osascript` no macOS, `notify-send` no Linux; uma verificação de quais navegadores estão instalados (Windows) ou de qual é o sistema (`uname`). E o `git`, só leitura (`rev-parse`, `status` e `diff --numstat`), na pasta de cada sessão, ao iniciar e no fim de cada turno, para *Agentes*. E o comando de *Verificação entre cartões* de um quadro, se houver, na pasta da sessão, quando um cartão da fila chega à última coluna.
- **Arquivos.** Ele grava só as ROMs que você adiciona com `/arcade-add`, em `~/.claude/arcade/roms`, e a pequena marca de cada sessão para *Agentes* e *Limites*, com as respostas enviadas de lá, em `~/.claude/arcade/agents`; lê só o arquivo que você indica, essas cópias, essas marcas e os próprios arquivos. Configurações, caderno, calendário e favoritos ficam no armazenamento de plugins do Claude Code.
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
- O caderno e o calendário ficam no seu computador. Os quadros compartilhados ficam guardados no site do Arcade e não são criptografados, como as conversas. As páginas só vão para o Notion ou outro aplicativo quando você pede, pelos seus próprios conectores do Claude; as issues e os comentários dos trackers também — o Arcade nunca fala por conta própria com o GitHub, o Linear, o Jira ou outros trackers.
- *Agentes* vê suas outras sessões por pequenos arquivos em `~/.claude/arcade/agents` — a pasta, o estado e o cartão de cada sessão, o texto da pergunta ou do pedido de permissão que ela aguarda, com o comando, e o seu contexto, custo e janelas de limite. As respostas enviadas de *Agentes* ficam ao lado. Eles ficam neste computador e nunca vão para o site do Arcade; num quadro compartilhado, seus amigos veem só «nas mãos de @apelido», como antes. Numa pasta com git, o arquivo de uma sessão guarda também a branch e os nomes dos arquivos alterados com o número de linhas — lidos pelo git na pasta da própria sessão e não enviados a lugar nenhum; o Arcade nunca faz commit, reverte nem guarda nada no stash.
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
- **Dentro do plugin:** o emulador JSNES 2.1.0 (Apache-2.0) e três jogos homebrew de NES para jogar offline — *Thwaite* e *Concentration Room*, de Damian Yerrick (GPL-3.0-or-later), e *robotfindskitten*, de Damian Yerrick a partir do jogo de Leonard Richardson (zlib). Os jogos ficam armazenados como dados em `mod/hooks/roms/`; o código-fonte (`.tar.gz`) e os textos das licenças estão em `mod/third_party/`.
- **O código do próprio Arcade** (o plugin e o site) — **GNU AGPL-3.0** ([LICENSE](LICENSE)), © 2026 Max Arbakov. Você pode usá-lo, estudá-lo e modificá-lo livremente. Se você distribuir uma versão modificada — ou rodá-la como serviço online para outras pessoas —, precisa publicar todo o seu código-fonte sob a mesma licença e manter os avisos de direitos autorais. Componentes de terceiros mantêm suas próprias licenças. O logotipo do Arcade, que também é o ícone do plugin, não está coberto por esta licença: só pode ser usado para se referir ao projeto Arcade.

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

Documentação detalhada (em russo): [mod/docs/README.ru.md](mod/docs/README.ru.md) — o plugin, [site/README.md](https://github.com/ArbakovMaxim/agent-arcade/tree/main/site/README.md) — o site, como adicionar jogos e o jogo em rede.
