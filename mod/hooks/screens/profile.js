// Arcade: экраны аккаунта и отчётов.
import { keep, tr } from '../i18n.js'
import { suggestHandle } from '../account.js'
import { when } from '../chats.js'
import { picSvg } from '../avatars.js'
import { S } from '../app/state.js'
import { cancelLogin, claimHandle, closeReport, deleteAccount, loadReports, logout, openGithub, pickAvatar, reportNote, sendReport, startLogin, syncAccount } from '../app/profile.js'

// Аккаунт: вошли — кто и что общее; идёт вход — код для GitHub; иначе — зачем вход и что Arcade узнает
export function accountScreen($, e, kit) {
  const { Box, Button, Input, Svg, Text, back, desktop, dim, gap, hint, noticeLines, picGrid, pictures, section, tiles } = kit
  let items
  const flow = S.acct.flow
  const note = S.acct.note ? [Text({ color: 'warning', children: [S.acct.note] })] : []
  if (S.acct.session) {
    // Ника нет, а имя на GitHub подходит под правила — его можно взять одной кнопкой
    const take = S.acct.handle ? '' : suggestHandle(S.acct.session.user.login)
    items = [
      back,
      gap,
      keep(Text({ bold: true, children: [`GitHub: @${S.acct.session.user.login}`] })),
      Text({ children: [S.acct.handle ? `Твой ник: @${S.acct.handle}` : 'Ника пока нет.'] }),
      dim('Ник видят соперники в сетевых партиях настольных игр. Сменить его можно когда угодно.'),
      ...(take ? [Button({ key: 'arcade-account-take', label: `Взять @${take}`, onPress: () => claimHandle($, take) })] : []),
      Input({ key: 'arcade-account-handle', label: S.acct.handle ? 'Сменить ник' : 'Свой ник', placeholder: 'латинские буквы, цифры и _, от 4 до 32 знаков', onSubmit: (value) => claimHandle($, value) }),
      ...(S.acct.naming ? [dim('Проверяю ник…')] : S.acct.handleNote ? [Text({ color: 'warning', children: [S.acct.handleNote] })] : []),
      // Дальше — группы под заголовками, как в настройках. В Desktop отступ сверху даёт сам заголовок
      ...(desktop ? [] : [gap]),
      section('Аватарка'),
      // Аватарку выбирают только здесь; чаты на сайте, в Desktop, VS Code и терминале её только показывают.
      // Нынешняя — крупно, ниже с отступом — выбор
      Box({
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 'sm',
        marginBottom: pictures ? 'md' : 1,
        children: [
          ...(pictures ? [Svg({ source: picSvg(S.acct.pic, S.acct.handle || '?', S.acct.handle || '?'), alt: 'Аватарка', width: 56, height: 56 })] : []),
          Box({ flexDirection: 'column', flexShrink: 1, minWidth: 0, children: [dim('Её видят друзья в чатах. Без неё — первая буква ника.')] }),
        ],
      }),
      picGrid('arcade-avatar', S.acct.pic, (n) => pickAvatar($, n), 'Без аватарки', picSvg(null, S.acct.handle || '?', S.acct.handle || '?')),
      ...(S.acct.picking ? [dim('Сохраняю аватарку…')] : S.acct.picNote ? [Text({ color: 'warning', children: [S.acct.picNote] })] : []),
      ...(desktop ? [] : [gap]),
      section('Синхронизация и вход'),
      dim('Общие для всех компьютеров: язык, клавиши, уведомления, размер панели, что делать с игрой по сигналу агента, свои темы, каналы Twitch и рекорд Flappy Arcade.'),
      ...note,
      // Действия — плитками, как везде; у синхронизации в описании — как она прошла
      tiles(
        [
          Button({ key: 'arcade-account-sync', label: 'Синхронизировать сейчас', autoFocus: true, onPress: () => syncAccount($) }),
          dim(S.acct.syncing ? 'Синхронизирую…' : S.acct.syncedAt ? 'Настройки синхронизированы.' : 'Настройки ещё не синхронизированы.'),
          Button({ key: 'arcade-account-logout', label: 'Выйти', onPress: () => logout($) }),
          dim('  на этом компьютере; настройки останутся здесь как есть'),
          Button({ key: 'arcade-account-delete', label: S.acct.confirmDelete ? 'Точно удалить? Нажми ещё раз' : 'Удалить аккаунт', onPress: () => deleteAccount($) }),
          dim('  сайт Arcade забудет тебя и твои настройки; здесь всё останется'),
        ],
        40,
      ),
      ...noticeLines,
      ...hint,
    ]
  } else if (flow) {
    items = [
      back,
      gap,
      Text({ children: ['Введи этот код на странице GitHub:'] }),
      keep(desktop ? Text({ size: 'heading', weight: 'semibold', children: [flow.code] }) : Text({ bold: true, children: [`  ${flow.code}`] })),
      gap,
      Button({ key: 'arcade-account-github', label: 'Открыть страницу GitHub', autoFocus: true, onPress: () => openGithub($, flow.url) }),
      keep(dim(`  ${flow.url}`)),
      dim('  страница откроется в обычном браузере; после кода GitHub спросит, пустить ли Agent Arcade'),
      gap,
      ...(note.length ? note : [dim('Жду, когда ты подтвердишь вход на GitHub…')]),
      Button({ key: 'arcade-account-cancel', label: 'Отмена', onPress: () => cancelLogin($) }),
      ...noticeLines,
      ...hint,
    ]
  } else {
    items = [
      back,
      gap,
      dim('Вход нужен, чтобы настройки были одни на всех твоих компьютерах и чтобы взять свой @ник для сетевых игр. Без входа всё работает.'),
      dim('Arcade узнаёт только имя и картинку профиля GitHub — ни почты, ни доступа к репозиториям.'),
      ...note,
      gap,
      Button({ key: 'arcade-account-login', label: S.acct.starting ? 'Прошу код у GitHub…' : 'Войти через GitHub', autoFocus: true, onPress: () => startLogin($) }),
      ...noticeLines,
      ...hint,
    ]
  }
  return items
}

// Отчёт об ошибке: что сломалось — словами. Читает его только автор Arcade; к тексту — версия, где открыт Arcade,
// язык и система. Со входом отчёт подписан аккаунтом, без входа — без подписи
export function reportScreen($, e, kit) {
  const { Input, Text, back, dim, gap, hint, noticeLines } = kit
  const note = S.rp.note ? [S.rp.bad ? Text({ color: 'warning', children: [S.rp.note] }) : dim(S.rp.note)] : []
  return [
    back,
    gap,
    Text({ children: ['Что сломалось? Опиши, что ты делал и что пошло не так.'] }),
    dim('Отчёты читает только автор Arcade. Не пиши пароли, ключи и личные данные.'),
    gap,
    Input({
      key: `arcade-report-text-${S.rp.field}`,
      label: 'Отчёт',
      placeholder: 'например: шашки зависают после хода дамкой',
      rows: 4,
      autoFocus: true,
      submitLabel: tr('Отправить', S.lang),
      onSubmit: (value) => sendReport($, value, e.surface),
    }),
    ...(S.rp.sending ? [dim('Отправляю отчёт…')] : note),
    gap,
    dim('К отчёту приложится версия Arcade, где он открыт, язык интерфейса и система — больше ничего.'),
    dim(S.acct.session ? 'Со входом через GitHub отчёт подписан твоим аккаунтом.' : 'Без входа отчёт уйдёт без подписи.'),
    ...noticeLines,
    ...hint,
  ]
}

// Отчёты об ошибках — только у админа: открытые, новые сверху. Текст отчёта и подпись — как есть (keep)
export function reportsScreen($, e, kit) {
  const { Box, Button, Text, back, dim, gap, hint, noticeLines, now } = kit
  const note = S.rp.listNote ? [S.rp.listBad ? Text({ color: 'warning', children: [S.rp.listNote] }) : dim(S.rp.listNote)] : []
  const list = S.rp.list ?? []
  const signed = (r) => (r.from ? keep(dim(r.from.handle ? `@${r.from.handle}` : `GitHub #${r.from.id}`)) : dim('без подписи'))
  const about = (r) => keep(dim([`#${r.id}`, when(r.at, now), r.version, r.surface, r.lang, r.os].filter(Boolean).join(' · ')))
  const entry = (r, k) => [
    gap,
    keep(Text({ children: [r.text] })),
    Box({
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: 2,
      children: [
        about(r),
        signed(r),
        Button({ key: `arcade-report-close-${r.id}`, label: S.rp.busy === r.id ? 'Закрываю…' : 'Закрыть', ...(k === 0 ? { autoFocus: true } : {}), onPress: () => closeReport($, r.id) }),
      ],
    }),
  ]
  return S.acct.role === 'admin'
      ? [
          back,
          gap,
          ...(list.length ? [Text({ children: [`Открытых отчётов: ${S.rp.open}`] })] : []),
          dim('Закрытый отчёт сайт удаляет. Здесь — последние 50, новые сверху.'),
          ...note,
          ...(list.length ? list.flatMap(entry) : [gap, dim(S.rp.list ? 'Открытых отчётов нет.' : S.rp.loading ? 'Загружаю отчёты…' : 'Список отчётов не загрузился.')]),
          gap,
          Button({ key: 'arcade-reports-refresh', label: S.rp.loading ? 'Обновляю…' : 'Обновить', ...(list.length ? {} : { autoFocus: true }), onPress: () => loadReports($) }),
          ...noticeLines,
          ...hint,
        ]
      : [back, gap, Text({ color: 'warning', children: [reportNote('admin')] }), ...noticeLines, ...hint]
}
