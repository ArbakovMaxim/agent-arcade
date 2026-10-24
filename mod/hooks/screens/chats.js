// Arcade: экран чатов.
import { keep, tr } from '../i18n.js'
import { clock, day } from '../chats.js'
import { letterColor, picSvg, validPic } from '../avatars.js'
import { PANE_COLUMNS, S } from '../app/state.js'
import { clip, log } from '../app/status.js'
import { startLogin, syncAccount } from '../app/profile.js'
import { CHAT_HOVER, CHAT_MINE, CHAT_PICKED, CHAT_SPLIT, CHAT_THEIRS, CHAT_WALL, changeMembers, chatPerson, chatSvg, chatTitle, createGroup, friendsCall, isOnline, leaveGroup, loadChats, olderMessages, olderShown, openChat, openChatPage, openDm, personSvg, renameGroup, sendMessage, serviceText } from '../app/talk.js'

// Чаты с друзьями: список, новый чат (с другом или группа), переписка и участники группы. Чужой текст —
// сообщения, ники, названия групп — не переводится (keep). Без входа и без ника — что сделать сначала
export function chatsScreen($, e, kit) {
  const { Box, Button, Input, Svg, Text, back, desktop, dim, gap, hint, noticeLines, now, open, picGrid, pictures, section } = kit
  let items
  const login = Button({
    key: 'arcade-chats-login',
    label: S.acct.starting ? 'Прошу код у GitHub…' : 'Войти через GitHub',
    autoFocus: true,
    onPress: () => {
      S.acct.confirmDelete = false
      open('account')()
      startLogin($)
    },
  })
  const note = S.ch.note ? [S.ch.bad ? Text({ color: 'warning', children: [S.ch.note] }) : dim(S.ch.note)] : []
  const row = (children) => Box({ flexDirection: 'row', columnGap: 2, children })
  const wrapRow = (children) => Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, children })
  // Название чата или группы: в Desktop — заголовком
  const heading = (text) => keep(desktop ? Text({ size: 'heading', weight: 'semibold', children: [text] }) : Text({ bold: true, children: [text] }))
  const toList = Button({
    key: 'arcade-chats-back',
    label: '← Чаты',
    onPress: () => {
      S.ch.note = ''
      S.ch.bad = false
      S.ch.confirmLeave = false
      open('chats')()
      loadChats($, true).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
    },
  })
  const pageButton = Button({ key: 'arcade-chats-page', label: S.ch.busy === 'page' ? 'Открываю…' : 'Открыть на странице', onPress: () => openChatPage($, e.surface) })
  const friends = S.fr.list?.friends ?? []
  // Чат как в Telegram: аватарки, «в сети», непрочитанные значком, своё справа, чужое слева, время и ✓, дни.
  // Картинки — везде, кроме терминала; там то же строение текстом
  const avatar = (source, alt, size) => Svg({ source, alt, width: size, height: size })
  const dot = () => Text({ color: 'success', children: ['●'] })
  const badge = (n) => keep(Text({ backgroundColor: 'suggestion', color: 'inverseText', weight: 'semibold', children: [` ${n} `] }))
  // Время в списке: сегодня — ЧЧ:ММ, вчера — «Вчера», раньше — дата
  const stamp = (at) => {
    const d = day(at, now)
    return d === 'Сегодня' ? clock(at) : tr(d, S.lang)
  }
  // Под названием чата: друг в сети; у группы — сколько участников и сколько из них в сети
  const status = (chat) => {
    if (chat.kind === 'dm') return isOnline(chat.with) ? [Text({ color: 'success', children: ['в сети'] })] : []
    const around = chat.members.filter((id) => id !== S.ch.me && isOnline(id)).length
    return [dim(around ? `участники: ${chat.members.length}, в сети: ${around}` : `участники: ${chat.members.length}`)]
  }
  // Как в Telegram: в широкой панели Desktop и VS Code список чатов всегда слева, а справа — переписка, новый чат
  // или участники группы. В узкой панели и в терминале — по очереди: «← Чаты» возвращает к списку
  const columns = e.viewport?.columns ?? PANE_COLUMNS
  const split = pictures && columns >= CHAT_SPLIT
  const listWidth = Math.min(40, Math.max(26, Math.floor(columns * 0.38)))
  const list = S.ch.list ?? []
  const toTalk = () => {
    S.ch.note = ''
    S.ch.bad = false
    S.ch.confirmLeave = false
    open('chats:talk')()
  }
  // Под названием чата — последнее сообщение одной строкой
  const preview = (c) => {
    const last = c.last
    if (!last) return tr('Здесь пока пусто — напиши первым.', S.lang)
    // Своё — «ты:», в группе — ник; в чате двоих чужое и так от друга. Служебное уже говорит, кто
    const who = last.t === undefined ? '' : last.f === S.ch.me ? tr('ты', S.lang) : c.kind === 'group' ? chatPerson(last.f) : ''
    const said = last.t === undefined ? serviceText(last) : who ? `${who}: ${last.t}` : last.t
    return clip(said, 120)
  }
  // Строка списка: аватарка, название, у друга в сети — ●, время последнего сообщения, под ним само сообщение
  // и непрочитанные значком. Чат, открытый справа, подсвечен и без значка; нажать на него — снова к переписке
  const chatRow = (c, focus) => {
    const title = chatTitle(c)
    const current = split && (S.menu === 'chats:talk' || S.menu === 'chats:members') && c.id === S.ch.talk
    const top = Box({
      flexDirection: 'row',
      justifyContent: 'space-between',
      columnGap: 1,
      children: [
        Box({
          flexDirection: 'row',
          alignItems: 'center',
          columnGap: 1,
          flexShrink: 1,
          minWidth: 0,
          children: [
            keep(
              Button({
                key: `arcade-chat-open-${c.id}`,
                label: split ? clip(title, listWidth - 14) : title,
                ...(focus ? { autoFocus: true } : {}),
                onPress: () => {
                  if (!current) return openChat($, c.id)
                  if (S.menu === 'chats:members') toTalk()
                },
              }),
            ),
            ...(c.kind === 'dm' && isOnline(c.with) ? [dot()] : []),
          ],
        }),
        ...(c.at ? [keep(dim(stamp(c.at)))] : []),
      ],
    })
    const bottom = Box({
      flexDirection: 'row',
      justifyContent: 'space-between',
      columnGap: 1,
      children: [Box({ flexShrink: 1, minWidth: 0, children: [keep(Text({ dimColor: true, wrap: 'truncate-end', children: [preview(c)] }))] }), ...(c.unread && !current ? [badge(c.unread)] : [])],
    })
    return Box({
      key: `chat-row-${c.id}`,
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 'sm',
      ...(pictures ? { padding: 'xs', hover: { backgroundColor: CHAT_HOVER } } : {}),
      ...(current ? { backgroundColor: CHAT_PICKED } : {}),
      children: [...(pictures ? [avatar(chatSvg(c), title, split ? 36 : 40)] : []), Box({ flexDirection: 'column', flexGrow: 1, flexShrink: 1, minWidth: 0, children: [top, bottom] })],
    })
  }
  // Чаты строками, новые сверху; пока их нет — почему. focusId — какой чат в фокусе
  const chatRows = (focusId) =>
    list.length
      ? [Box({ flexDirection: 'column', rowGap: pictures ? 'xs' : 0, children: list.map((c) => chatRow(c, c.id === focusId)) })]
      : [
          dim(S.ch.list ? 'Чатов пока нет. Нажми «Новый чат» и выбери друга.' : S.ch.loading ? 'Загружаю чаты…' : 'Список чатов не загрузился.'),
          ...(!S.ch.list && !S.ch.loading ? [gap, Button({ key: 'arcade-chats-refresh', label: 'Обновить', onPress: () => loadChats($) })] : []),
        ]
  // «Новый чат» — главной кнопкой, где есть картинки; в фокусе — когда вернулись из него или чатов нет
  const newChat = Button({
    key: 'arcade-chat-new',
    label: 'Новый чат',
    ...(pictures ? { variant: 'primary' } : {}),
    ...(S.menu === 'chats' && (S.menuFrom === 'chats:new' || (S.ch.list && !list.length)) ? { autoFocus: true } : {}),
    onPress: () => {
      S.ch.picked = new Set()
      S.ch.groupName = ''
      S.ch.field++
      S.ch.note = ''
      S.ch.bad = false
      open('chats:new')()
      friendsCall($, 'friends')
    },
  })
  // Широкая панель: сверху top, ниже слева список — «Чаты», «Новый чат» и сами чаты, справа content
  const beside = (top, content, focusId = '') => [
    ...top,
    Box({
      flexDirection: 'row',
      columnGap: 'lg',
      children: [
        Box({
          flexDirection: 'column',
          width: listWidth,
          flexShrink: 0,
          rowGap: 'xs',
          children: [
            Box({ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', columnGap: 1, children: [Text({ size: 'heading', weight: 'semibold', children: ['Чаты'] }), newChat] }),
            ...chatRows(focusId),
          ],
        }),
        Box({ flexDirection: 'column', flexGrow: 1, flexShrink: 1, minWidth: 0, children: content }),
      ],
    }),
    ...noticeLines,
    ...hint,
  ]
  // Первый заголовок экрана справа — вровень с «Чаты» слева, без отступа сверху
  const lead = (title) => (split ? Text({ size: 'heading', weight: 'semibold', children: [title] }) : section(title))
  if (!S.acct.session) {
    items = [
      back,
      gap,
      dim('Чаты в Arcade — с друзьями: переписка один на один, группы и общий чат со всеми друзьями.'),
      Text({ children: ['Чтобы писать друзьям, войди через GitHub.'] }),
      dim('Arcade узнаёт только имя и картинку профиля GitHub — ни почты, ни доступа к репозиториям.'),
      // Вход только что пропал (сайт его не принял) — почему
      ...(S.acct.note ? [gap, Text({ color: 'warning', children: [S.acct.note] })] : []),
      gap,
      login,
      ...noticeLines,
      ...hint,
    ]
  } else if (!S.acct.handle && !S.acct.syncedAt) {
    // Сайт ещё не сказал, есть ли у человека ник
    items = [
      back,
      gap,
      ...(S.acct.syncing ? [dim('Спрашиваю сайт Arcade…')] : S.acct.note ? [Text({ color: 'warning', children: [S.acct.note] })] : []),
      gap,
      Button({
        key: 'arcade-chats-sync',
        label: 'Обновить',
        autoFocus: true,
        onPress: async () => {
          await syncAccount($)
          if (S.acct.handle && !S.ch.list) await loadChats($)
        },
      }),
      ...noticeLines,
      ...hint,
    ]
  } else if (!S.acct.handle) {
    items = [
      back,
      gap,
      Text({ children: ['Писать друзьям можно, когда у тебя есть @ник — сначала возьми свой.'] }),
      dim('Ник видят друзья и соперники в сетевых партиях. Сменить его можно когда угодно — друзья останутся.'),
      gap,
      Button({ key: 'arcade-chats-handle', label: 'Взять @ник', autoFocus: true, onPress: open('account') }),
      ...noticeLines,
      ...hint,
    ]
  } else if (S.menu === 'chats:new') {
    // Новый чат: с другом — сразу, группа — отметить друзей и назвать
    const content = [
      lead('Написать'),
      ...(friends.length
        ? [
            wrapRow(
              friends.map((p, k) =>
                Box({
                  flexDirection: 'row',
                  alignItems: 'center',
                  columnGap: 1,
                  children: [
                    ...(pictures ? [avatar(picSvg(p.pic, p.handle, p.handle), `@${p.handle}`, 24)] : []),
                    keep(Button({ key: `arcade-chat-dm-${p.id}`, label: `@${p.handle}`, ...(k === 0 ? { autoFocus: true } : {}), onPress: () => openDm($, p.id) })),
                    ...(isOnline(p.id) ? [dot()] : []),
                  ],
                }),
              ),
            ),
          ]
        : [
            dim(S.fr.list ? 'Друзей пока нет — добавь кого-нибудь по @нику.' : S.fr.loading ? 'Загружаю друзей…' : 'Список друзей не загрузился.'),
            gap,
            Button({
              key: 'arcade-chats-friends',
              label: 'Друзья',
              autoFocus: true,
              onPress: () => {
                S.fr.note = ''
                S.fr.bad = false
                open('friends')()
                friendsCall($, 'friends')
              },
            }),
          ]),
      ...(friends.length
        ? [
            section('Группа'),
            dim('Группа: отметь друзей, назови её и нажми «Создать группу».'),
            wrapRow(
              friends.map((p) =>
                keep(
                  Button({
                    key: `arcade-chat-pick-${p.id}`,
                    label: `${S.ch.picked.has(p.id) ? '☑' : '☐'} @${p.handle}`,
                    onPress: () => {
                      if (S.ch.picked.has(p.id)) S.ch.picked.delete(p.id)
                      else S.ch.picked.add(p.id)
                      S.ch.note = ''
                      S.ch.bad = false
                      $.ui.invalidate('ui.render')
                    },
                  }),
                ),
              ),
            ),
            gap,
            // Что вписано, помним сами: «Создать группу» — кнопка, а не Enter в поле
            Input({
              key: `arcade-chat-name-${S.ch.field}`,
              label: 'Название группы',
              placeholder: 'например: шахматный клуб',
              onInput: (value) => {
                S.ch.groupName = value
              },
              onSubmit: (value) => {
                S.ch.groupName = value
                return createGroup($)
              },
            }),
            row([
              Button({ key: 'arcade-chat-create', label: S.ch.busy === 'group' ? 'Создаю…' : 'Создать группу', onPress: () => createGroup($) }),
              Button({ key: 'arcade-chat-all', label: 'Группа со всеми друзьями', onPress: () => createGroup($, true) }),
            ]),
          ]
        : []),
      ...(S.ch.busy === 'open' ? [gap, dim('Открываю чат…')] : note.length ? [gap, ...note] : []),
    ]
    items = split ? beside([back, gap], content) : [toList, ...content, ...noticeLines, ...hint]
  } else if (S.menu === 'chats:talk') {
    // Переписка как в Telegram: шапка с аватаркой и «в сети», дни разделителями, своё справа, чужое слева, в группе —
    // с аватаркой и ником автора. Последние ch.shown сообщений, «Раньше» — ещё; новые приходят по таймеру
    const about = S.ch.about
    const listed = S.ch.list?.find((c) => c.id === S.ch.talk)
    const chat = about ?? listed
    const title = chat ? chatTitle(chat) : ''
    const group = chat?.kind === 'group'
    const membersButton = Button({
      key: 'arcade-chat-members',
      label: 'Участники',
      onPress: () => {
        S.ch.note = ''
        S.ch.bad = false
        S.ch.confirmLeave = false
        open('chats:members')()
        // Хозяину — список друзей: кого добавить
        if (about.owner === S.ch.me) friendsCall($, 'friends')
      },
    })
    // Под названием: друг в сети или сколько в группе людей; у группы — ещё кнопка «Участники»
    const statusLine = [...(about ? status(about) : listed?.kind === 'dm' ? status(listed) : []), ...(about?.kind === 'group' ? [membersButton] : [])]
    const header = Box({
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 'sm',
      children: [
        ...(pictures && chat ? [avatar(chatSvg(chat), title, 40)] : []),
        Box({ flexDirection: 'column', flexGrow: 1, flexShrink: 1, minWidth: 0, children: [...(title ? [heading(title)] : []), ...(statusLine.length ? [row(statusLine)] : [])] }),
      ],
    })
    // День: «Сегодня», «Вчера» или дата — посередине; в терминале — чертой
    const dayLine = (at) => {
      const d = tr(day(at, now), S.lang)
      return Box({ flexDirection: 'row', justifyContent: 'center', ...(pictures ? { paddingY: 'sm' } : {}), children: [keep(dim(pictures ? d : `── ${d} ──`))] })
    }
    // Служебное (создал, добавил, переименовал) — посередине, тускло
    const service = (m) => Box({ flexDirection: 'row', justifyContent: 'center', paddingX: 4, children: [keep(Text({ dimColor: true, wrap: 'wrap', children: [serviceText(m)] }))] })
    // Сообщение. Под текстом — время, у своего ещё ✓: дошло до сайта (прочитано ли, Arcade не показывает).
    // Где рисуют картинки — пузырём в рамке, своё — цветом акцента; в терминале — текст и время в строку.
    // В группе у первого сообщения подряд от одного человека — его аватарка и ник цветом от ника
    const message = (m, first, spaced) => {
      const mine = m.f === S.ch.me
      const author = group && !mine
      const time = keep(Text({ dimColor: true, size: 'footnote', children: [mine ? `${clock(m.at)} ✓` : clock(m.at)] }))
      const text = keep(Text({ wrap: 'wrap', children: [m.t] }))
      const name = author && first ? [keep(Text({ weight: 'semibold', color: letterColor(S.ch.names[m.f] || m.f), children: [chatPerson(m.f)] }))] : []
      const body = pictures
        ? Box({
            flexDirection: 'column',
            flexShrink: 1,
            minWidth: 0,
            borderStyle: 'round',
            borderColor: mine ? 'suggestion' : 'subtle',
            backgroundColor: mine ? CHAT_MINE : CHAT_THEIRS,
            paddingX: 'md',
            paddingY: 'xs',
            children: [...name, text, Box({ flexDirection: 'row', justifyContent: 'flex-end', children: [time] })],
          })
        : Box({ flexDirection: 'column', flexShrink: 1, minWidth: 0, children: [...name, Box({ flexDirection: 'row', columnGap: 1, children: [Box({ flexShrink: 1, minWidth: 0, children: [text] }), time] })] })
      // Место под аватарку — у каждого чужого сообщения группы, чтобы пузыри стояли ровно; сама она — у первого
      const face = author && pictures ? [Box({ width: 5, flexShrink: 0, children: first ? [avatar(personSvg(m.f), chatPerson(m.f), 28)] : [] })] : []
      return Box({
        flexDirection: 'row',
        justifyContent: mine ? 'flex-end' : 'flex-start',
        ...(mine ? { paddingLeft: 8 } : { paddingRight: 8 }),
        // Сменился автор — отступ побольше, как в Telegram; подряд от одного человека — плотнее
        ...(pictures ? (spaced ? { marginTop: 'sm' } : {}) : name.length ? { marginTop: 1 } : {}),
        children: [...face, body],
      })
    }
    // Подряд от одного человека в один день — без повторного ника и аватарки; новый день — разделитель
    const shown = S.ch.messages.slice(-S.ch.shown)
    const lines = shown.flatMap((m, k) => {
      const before = shown[k - 1]
      const newDay = !before || day(before.at, now) !== day(m.at, now)
      const other = !newDay && (Boolean(before.k) || before.f !== m.f)
      return [...(newDay ? [dayLine(m.at)] : []), m.k ? service(m) : message(m, newDay || other, other)]
    })
    const area = [
      ...(olderShown() ? [Box({ flexDirection: 'row', justifyContent: 'center', children: [Button({ key: 'arcade-chat-older', label: S.ch.older ? 'Загружаю…' : 'Раньше', onPress: () => olderMessages($) })] })] : []),
      ...(S.ch.opening
        ? [dim('Загружаю переписку…')]
        : about && !S.ch.messages.length
          ? [dim('Здесь пока пусто — напиши первым.')]
          : [Box({ flexDirection: 'column', rowGap: pictures ? 'xs' : 0, children: lines })]),
    ]
    const talk = [
      header,
      gap,
      // Где есть картинки — переписка на своём фоне в рамке, как обои в мессенджере
      ...(pictures ? [Box({ flexDirection: 'column', rowGap: 'sm', padding: 'md', borderStyle: 'round', borderColor: 'subtle', backgroundColor: CHAT_WALL, children: area })] : area),
      ...(about
        ? [
            gap,
            Input({ key: `arcade-chat-input-${S.ch.field}`, label: 'Сообщение', autoFocus: true, submitLabel: tr('Отправить', S.lang), onSubmit: (value) => sendMessage($, value) }),
            dim('Переписка не шифруется — не пиши сюда пароли и ключи.'),
          ]
        : []),
      ...(S.ch.busy === 'send' ? [dim('Отправляю…')] : note),
      gap,
      pageButton,
    ]
    items = split ? beside([back, gap], talk) : [toList, gap, ...talk, ...noticeLines, ...hint]
  } else if (S.menu === 'chats:members') {
    // Участники группы: хозяин переименовывает, ставит картинку, добавляет друзей и убирает людей; выйти может любой
    const about = S.ch.about
    const owner = Boolean(about) && about.owner === S.ch.me
    const members = about?.members ?? []
    const others = friends.filter((p) => !members.includes(p.id))
    const current = validPic(about?.pic) ? about.pic : null
    const content = [
      Button({ key: 'arcade-back', label: '← Назад', autoFocus: true, onPress: toTalk }),
      gap,
      ...(about
        ? [
            Box({
              flexDirection: 'row',
              alignItems: 'center',
              columnGap: 'sm',
              children: [...(pictures ? [avatar(chatSvg(about), chatTitle(about), 40)] : []), Box({ flexDirection: 'column', flexShrink: 1, minWidth: 0, children: [heading(chatTitle(about)), ...status(about)] })],
            }),
          ]
        : []),
      // Подсказка в поле — нынешнее название группы, его не переводим
      ...(owner
        ? [gap, keep(Input({ key: `arcade-chat-rename-${S.ch.field}`, label: tr('Переименовать', S.lang), placeholder: about.name || tr('Название группы', S.lang), onSubmit: (value) => renameGroup($, value) }))]
        : []),
      section('Участники'),
      ...members.map((id) =>
        Box({
          flexDirection: 'row',
          alignItems: 'center',
          columnGap: pictures ? 'sm' : 2,
          children: [
            ...(pictures ? [avatar(personSvg(id), chatPerson(id), 28)] : []),
            keep(Text({ children: [chatPerson(id)] })),
            ...(id !== S.ch.me && isOnline(id) ? [Text({ color: 'success', children: ['в сети'] })] : []),
            ...(id === about.owner ? [dim('управляет группой')] : []),
            ...(owner && id !== S.ch.me ? [Button({ key: `arcade-chat-remove-${id}`, label: 'Убрать', onPress: () => changeMembers($, { remove: [id] }, 'Участник убран.') })] : []),
          ],
        }),
      ),
      ...(owner && others.length
        ? [
            section('Добавить друзей'),
            wrapRow(others.map((p) => keep(Button({ key: `arcade-chat-add-${p.id}`, label: `+ @${p.handle}`, onPress: () => changeMembers($, { add: [p.id] }, 'Участник добавлен.') })))),
          ]
        : []),
      // Картинку группы ставит хозяин; без неё — первая буква названия
      ...(owner
        ? [
            section('Картинка группы'),
            picGrid('arcade-chat-pic', current, (n) => n !== current && changeMembers($, { pic: n }, 'Картинка группы изменена.'), 'Без картинки', picSvg(null, about.name || tr('Группа', S.lang), about.id)),
          ]
        : []),
      ...(about ? [gap, Button({ key: 'arcade-chat-leave', label: S.ch.confirmLeave ? 'Точно выйти? Нажми ещё раз' : 'Выйти из группы', onPress: () => leaveGroup($) })] : []),
      ...(S.ch.busy === 'members' ? [dim('Сохраняю…')] : note),
    ]
    // Рядом со списком «← Назад» у участников — к переписке; к главному меню — оттуда
    items = split ? beside([], content) : [...content, ...noticeLines, ...hint]
  } else {
    // Список чатов. В широкой панели справа от него — что открыть, пока чат не выбран
    const fromTalk = S.menuFrom === 'chats:talk' || S.menuFrom === 'chats:members'
    const focusId = fromTalk ? S.ch.talk : S.menuFrom === 'chats:new' ? '' : list[0]?.id
    const privacy = dim('Переписка хранится на сайте Arcade и не шифруется — не пиши туда пароли и ключи.')
    items = split
      ? beside(
          [back, gap],
          [
            Box({
              flexDirection: 'column',
              alignItems: 'center',
              paddingY: 'xl',
              borderStyle: 'round',
              borderColor: 'subtle',
              backgroundColor: CHAT_WALL,
              children: [dim('Выбери чат слева или начни новый.')],
            }),
            ...(note.length ? [gap, ...note] : []),
            gap,
            pageButton,
            gap,
            privacy,
          ],
          focusId,
        )
      : [
          back,
          gap,
          row([newChat, pageButton]),
          ...(note.length ? [gap, ...note] : []),
          section('Чаты'),
          ...chatRows(focusId),
          gap,
          privacy,
          ...noticeLines,
          ...hint,
        ]
  }
  return items
}
