/**
 * The shape of the 浏览器 settings page, as data.
 *
 * The page shows three rows and nothing else: which browser, whether it gets a
 * window, and where its profile lives. Those three are the choices a user
 * actually makes, and none of them can be inferred from how the plugin is used.
 *
 * The rest of the configuration is not on the page at all. Every one of those
 * fields has a default that only needs changing when something is wrong, and a
 * settings page that lists them is a settings page nobody reads: P1 added two
 * rows and the page turned into a wall of controls a non-developer cannot
 * classify — measured 2026-10-18, when the fold advertised "2 项已自定义" for the
 * two viewport fields, i.e. the two entries nobody could interpret. They remain
 * ordinary configuration in `cordis.yml`, still volatile, so a write there still
 * reaches a running browser.
 *
 * {@link HIDDEN_FIELDS} names them rather than leaving their absence implicit:
 * a configuration field has to be either placed or hidden on purpose, and
 * `test/settings-layout.test.ts` rejects a field that is neither. That is the
 * point the two-tier layout kept — nothing can slip off the page silently — with
 * the exposure decided by who the reader is instead of by what the schema marks
 * volatile.
 *
 * It is a plain `.ts` module because the section itself is a `.tsx`, which no
 * test can import: Node strips types, not JSX. Everything here is free of React,
 * so the page's copy decisions — the status banner, the session lines — are
 * testable on their own.
 */
import type { DshBrowserKey } from './locales.ts'
import type { ClientBrowserReport, ClientBrowserStatus } from './api.ts'

/** The configuration fields the settings page edits. */
export interface BrowserSettingsView {
  readonly channel: 'chrome' | 'msedge'
  readonly executablePath: string
  readonly headless: boolean
  readonly stealth: boolean
  readonly userDataDir: string
  readonly debugPortMin: number
  readonly debugPortMax: number
  readonly viewportWidth: number
  readonly viewportHeight: number
  readonly quality: number
  readonly snapshotAttributes: string
  readonly snapshotIgnore: string
}

/** One field's place on the page. */
export interface FieldPlacement {
  /** The configuration field this placement renders. */
  readonly field: keyof BrowserSettingsView
}

/**
 * The fields the page renders, in page order.
 *
 * A field may appear once; the page renders exactly this list, so a field the
 * loader lets the settings page write is either here or in
 * {@link HIDDEN_FIELDS}, and the test fails when the two lists do not add up to
 * the schema's volatile set.
 */
export const FIELD_PLACEMENTS: readonly FieldPlacement[] = [
  { field: 'headless' },
  { field: 'channel' },
  { field: 'userDataDir' },
]

/**
 * The volatile fields the page deliberately does not render.
 *
 * Each one is editable in `cordis.yml` and takes effect there; what they do not
 * get is a control, because a control would be asking the user a question only a
 * failure can pose:
 *
 * - `stealth` — the default is the only sane value; off exists to reproduce the
 *   A/B that justifies the default, not as a preference.
 * - `executablePath` — for installs the `channel` lookup misses.
 * - `debugPortMin` / `debugPortMax` — only when the port window collides with
 *   something else on this machine, or a deployment opens more sessions than
 *   the window is wide.
 * - `viewportWidth` / `viewportHeight` — the initial size; a panel that connects
 *   reports its own and overrides it, so the value is felt only by a browser
 *   nobody is watching.
 * - `quality` — mirror sharpness against bandwidth, and the default is the
 *   measured middle.
 * - `snapshotAttributes` / `snapshotIgnore` — what the agent's snapshot prints;
 *   a deployment's knob, not a user's.
 */
export const HIDDEN_FIELDS = [
  'stealth',
  'executablePath',
  'debugPortMin',
  'debugPortMax',
  'viewportWidth',
  'viewportHeight',
  'quality',
  'snapshotAttributes',
  'snapshotIgnore',
] as const satisfies readonly (keyof BrowserSettingsView)[]

/** The label and hint one field's row renders. */
export interface FieldCopy {
  /** The row's visible label. */
  readonly label: DshBrowserKey
  /** The line under it, when the label alone does not explain the field. */
  readonly hint?: DshBrowserKey
}

/**
 * Copy for every configuration field, placed or hidden.
 *
 * A separate table from {@link FIELD_PLACEMENTS} because the order the page
 * renders in and the words it uses are different concerns that happen to share a
 * key. It stays total over the view — a hidden field keeps its words so that the
 * next person to ask "why is this not on the page" reads the same sentence the
 * row would have shown, and so re-exposing one needs no new copy.
 */
export const FIELD_COPY: Record<keyof BrowserSettingsView, FieldCopy> = {
  headless: { label: 'settingsMode', hint: 'settingsHeadlessNote' },
  channel: { label: 'settingsBrowser' },
  // The hint belongs to the directory row below this one, which only exists in
  // persistent mode; the mode select explains itself through its options.
  userDataDir: { label: 'settingsProfile' },
  stealth: { label: 'settingsStealth', hint: 'settingsStealthNote' },
  executablePath: { label: 'settingsExecutable' },
  debugPortMin: { label: 'settingsDebugPortMin', hint: 'settingsDebugPortHint' },
  debugPortMax: { label: 'settingsDebugPortMax' },
  viewportWidth: { label: 'settingsWidth' },
  viewportHeight: { label: 'settingsHeight' },
  quality: { label: 'settingsQuality' },
  snapshotAttributes: { label: 'settingsSnapshotAttributes', hint: 'settingsSnapshotAttributesHint' },
  snapshotIgnore: { label: 'settingsSnapshotIgnore', hint: 'settingsSnapshotIgnoreHint' },
}

/**
 * The directory a persistent profile uses when the user does not name one.
 *
 * Choosing 「保留登录」 has to mean something on its own: the mode select cannot
 * write "keep the sign-ins" without a directory, because the empty string is
 * what selects a fresh temporary profile. So the page fills this in, which
 * also answers the question the empty box used to ask — a user who wants to
 * stay signed in has no reason to invent a path, and `~` is expanded by the
 * host, so this spelling works on every platform.
 */
export const DEFAULT_PROFILE_DIR = '~/.dsh/browser-profiles'

/** The row that continues the profile field once a directory is wanted. */
export const PROFILE_DIR_COPY: FieldCopy = { label: 'settingsProfileDir', hint: 'settingsProfileDirHint' }

/**
 * What the banner says about the browsers right now.
 *
 * The state is the host's, not the form's: it is the only way a user can tell a
 * saved value from a value a browser is actually running with.
 * @param report - the last read, or `undefined` before the first answer.
 * @param t - copy for this namespace.
 * @returns the banner's summary line.
 */
export function statusLine(report: ClientBrowserReport | undefined, t: (key: DshBrowserKey) => string): string {
  if (report === undefined) return t('settingsStatusReading')
  const running = report.instances.filter(instance => instance.state === 'ready').length
  const starting = report.instances.filter(instance => instance.state === 'starting').length
  if (running > 0) return t('settingsStatusRunning').replace('{count}', String(running))
  if (starting > 0) return t('settingsStatusStarting').replace('{count}', String(starting))
  return t('settingsStatusNone')
}

/**
 * One session's browser as a single line: which session, what state, and the
 * facts only a running one has.
 * @param instance - one entry of the report.
 * @param t - copy for this namespace.
 * @returns the line to show for it.
 */
export function instanceLine(instance: ClientBrowserStatus, t: (key: DshBrowserKey) => string): string {
  const state = instance.state === 'ready'
    ? t('settingsInstanceStateRunning')
    : instance.state === 'starting'
      ? t('settingsInstanceStateStarting')
      : instance.state === 'failed'
        ? `${t('settingsInstanceStateFailed')} — ${instance.error ?? ''}`.trim()
        : t('settingsInstanceStateStopped')
  // Every session id starts with `session-`, so shortening the raw id would
  // print the same eight characters for all of them.
  const label = instance.sessionId.replace(/^session-/, '').slice(0, 8)
  const parts = [`${t('settingsSession')} ${label}`, state]
  if (instance.debugPort !== undefined) parts.push(`CDP 127.0.0.1:${instance.debugPort}`)
  if (instance.mode !== undefined) parts.push(instance.mode)
  const pages = instance.tabs?.length ?? 0
  if (pages > 0) parts.push(t('settingsInstancePages').replace('{count}', String(pages)))
  return parts.join(' · ')
}
