// Arcade: экраны друзей и приглашения.
import { keep } from '../i18n.js'
import { S } from '../app/state.js'
import { saveSetting, startLogin, syncAccount } from '../app/profile.js'
import { INVITE_MINUTES, addFriend, friendsCall, inviteFriend, inviteGames, pulseSoon } from '../app/talk.js'

// Во что позвать друга: настольные — в новую комнату на двоих, Doom — в лобби игры. Игра откроется и у тебя
export function inviteScreen($, e, kit) {
  const { Button, Text, dim, gap, hint, noticeLines, open, tiles } = kit
  const to = S.ol.to
  const kindNote = (g) => (g.kind === 'board' ? '  своя комната на двоих' : g.net === 'doom' || g.net === 'heretic-dm' ? '  общее лобби deathmatch' : '  кооператив: лобби игры')
  return [
    Button({ key: 'arcade-back', label: '← Назад', onPress: open('friends') }),
    gap,
    Text({ children: [`Во что позвать @${to.handle}?`] }),
    dim(`Друг увидит приглашение в Arcade, когда меню открыто, — оно действует ${INVITE_MINUTES} минут. Игра откроется и у тебя.`),
    gap,
    tiles(inviteGames().flatMap((g, k) => [Button({ key: `arcade-inv-game-${g.id}`, label: g.title, ...(k === 0 ? { autoFocus: true } : {}), onPress: () => inviteFriend($, e.surface, to, g.id) }), dim(kindNote(g))])),
    ...(S.ol.busy ? [gap, dim('Зову…')] : S.ol.note ? [gap, S.ol.bad ? Text({ color: 'warning', children: [S.ol.note] }) : dim(S.ol.note)] : []),
    ...noticeLines,
    ...hint,
  ]
}

// Друзья: взаимные заявки по точному @нику. Без входа и без ника — что сделать сначала
export function friendsScreen($, e, kit) {
  const { Box, Button, Input, Text, back, dim, gap, hint, inviteRows, noticeLines, open, section, windowed } = kit
  let items
  const login = Button({
    key: 'arcade-friends-login',
    label: S.acct.starting ? 'Прошу код у GitHub…' : 'Войти через GitHub',
    autoFocus: true,
    onPress: () => {
      S.acct.confirmDelete = false
      open('account')()
      startLogin($)
    },
  })
  const note = S.fr.note ? [S.fr.bad ? Text({ color: 'warning', children: [S.fr.note] }) : dim(S.fr.note)] : []
  const person = (p) => keep(Text({ children: [`@${p.handle}`] }))
  const row = (children) => Box({ flexDirection: 'row', columnGap: 2, children })
  if (!S.acct.session) {
    items = [
      back,
      gap,
      dim('Друзья в Arcade — по @нику: отправь заявку, друг примет её у себя, и вы появитесь в списках друг у друга.'),
      Text({ children: ['Чтобы список друзей был доступен, войди через GitHub.'] }),
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
      Button({ key: 'arcade-friends-sync', label: 'Обновить', autoFocus: true, onPress: () => syncAccount($) }),
      ...noticeLines,
      ...hint,
    ]
  } else if (!S.acct.handle) {
    items = [
      back,
      gap,
      Text({ children: ['Друзья находят друг друга по @нику — сначала возьми свой.'] }),
      dim('Ник видят друзья и соперники в сетевых партиях. Сменить его можно когда угодно — друзья останутся.'),
      gap,
      Button({ key: 'arcade-friends-handle', label: 'Взять @ник', autoFocus: true, onPress: open('account') }),
      ...noticeLines,
      ...hint,
    ]
  } else if (S.menu === 'friends:remove') {
    items = [
      Button({ key: 'arcade-back', label: '← Назад', onPress: open('friends') }),
      gap,
      dim('Кого удалить из друзей? Уведомления не будет; у друга ты тоже пропадёшь из списка.'),
      gap,
      ...(S.fr.list?.friends ?? []).map((p, k) =>
        keep(Button({ key: `arcade-fr-remove-${p.id}`, label: `@${p.handle}`, ...(k === 0 ? { autoFocus: true } : {}), onPress: () => friendsCall($, 'unfriend', { id: p.id }, p.handle, `@${p.handle} больше не в друзьях.`) })),
      ),
      ...(note.length ? [gap, ...note] : []),
      ...hint,
    ]
  } else {
    const list = S.fr.list
    const friends = list?.friends ?? []
    const incoming = list?.incoming ?? []
    const outgoing = list?.outgoing ?? []
    const fromRemove = S.menuFrom === 'friends:remove'
    // Друзья — по одному в строке, кто в сети — сверху; «Позвать» — где есть окно браузера для сетевых игр
    const shown = [...friends].sort((a, b) => Number(S.ol.online.has(b.id)) - Number(S.ol.online.has(a.id)))
    const friendRow = (p) =>
      row([
        person(p),
        ...(S.ol.online.has(p.id) ? [Text({ color: 'success', children: ['в сети'] })] : []),
        ...(windowed
          ? [
              Button({
                key: `arcade-fr-invite-${p.id}`,
                label: 'Позвать',
                ...(S.menuFrom === 'friends:invite' && S.ol.to?.id === p.id ? { autoFocus: true } : {}),
                onPress: () => {
                  S.ol.to = p
                  S.ol.note = ''
                  S.ol.bad = false
                  open('friends:invite')()
                },
              }),
            ]
          : []),
      ])
    const olNote = S.ol.note ? [S.ol.bad ? Text({ color: 'warning', children: [S.ol.note] }) : dim(S.ol.note)] : []
    items = [
      back,
      gap,
      Text({ children: [`Твой ник: @${S.acct.handle}`] }),
      dim('Друзья добавляют тебя по нему, а ты их — по их @нику.'),
      gap,
      Input({ key: 'arcade-friends-add', label: 'Добавить друга', placeholder: '@ник друга, точно как есть', onSubmit: (value) => addFriend($, value) }),
      ...(S.fr.busy === 'friends' ? [dim('Отправляю заявку…')] : note.length ? note : [dim('Подсказок по буквам нет: заявка дойдёт, только если ник написан точно.')]),
      ...(S.ol.invites.length ? [section('Зовут сыграть'), ...S.ol.invites.flatMap((invite, k) => inviteRows(invite, k === 0 && !fromRemove))] : []),
      ...(incoming.length
        ? [
            section('Заявки тебе'),
            ...incoming.map((p, k) =>
              row([
                person(p),
                Button({ key: `arcade-fr-accept-${p.id}`, label: 'Принять', ...(k === 0 && !fromRemove ? { autoFocus: true } : {}), onPress: () => friendsCall($, 'accept', { id: p.id }, p.handle, `Теперь вы с @${p.handle} друзья.`) }),
                Button({ key: `arcade-fr-decline-${p.id}`, label: 'Отклонить', onPress: () => friendsCall($, 'unfriend', { id: p.id }, p.handle, `Заявка от @${p.handle} отклонена.`) }),
              ]),
            ),
          ]
        : []),
      section('Друзья'),
      ...(friends.length
        ? shown.map(friendRow)
        : [dim(list ? 'Друзей пока нет — добавь кого-нибудь по @нику.' : S.fr.loading ? 'Загружаю друзей…' : 'Список друзей не загрузился.')]),
      ...(olNote.length ? [gap, ...olNote] : []),
      ...(friends.length ? [gap, Button({ key: 'arcade-fr-remove', label: 'Удалить друга', ...(fromRemove ? { autoFocus: true } : {}), onPress: open('friends:remove') })] : []),
      ...(outgoing.length
        ? [
            section('Твои заявки'),
            ...outgoing.map((p) =>
              row([person(p), dim('ждёт ответа'), Button({ key: `arcade-fr-cancel-${p.id}`, label: 'Отменить', onPress: () => friendsCall($, 'unfriend', { id: p.id }, p.handle, `Заявка для @${p.handle} отменена.`) })]),
            ),
          ]
        : []),
      gap,
      // Прятаться можно: тогда друзья не видят тебя в сети, а ты их видишь
      Button({
        key: 'arcade-fr-hide',
        label: `Показывать друзьям, что я в сети: ${S.hideOnline ? 'нет' : 'да'}`,
        onPress: async () => {
          S.hideOnline = !S.hideOnline
          $.ui.invalidate('ui.render')
          await saveSetting($, 'hideOnline', S.hideOnline)
          pulseSoon($)
        },
      }),
      Button({ key: 'arcade-fr-refresh', label: S.fr.loading ? 'Обновляю…' : 'Обновить', onPress: () => friendsCall($, 'friends') }),
      ...noticeLines,
      ...hint,
    ]
  }
  return items
}
