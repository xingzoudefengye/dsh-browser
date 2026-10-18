/**
 * The settings page is a short form plus a status banner, so its shape is a
 * decision worth pinning down: which fields a user sees, which ones are off the
 * page on purpose, whether every field still has words, and whether the banner
 * says enough once its per-session detail is collapsed.
 *
 * The layout lives in `src/client/settings-layout.ts` rather than in the
 * component because a `.tsx` cannot be imported here — Node strips types, not
 * JSX — and because these are decisions, not markup.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Config } from '../src/config.ts'
import { en, zh, type DshBrowserKey } from '../src/client/locales.ts'
import type { ClientBrowserStatus } from '../src/client/api.ts'
import {
  FIELD_COPY,
  FIELD_PLACEMENTS,
  HIDDEN_FIELDS,
  PROFILE_DIR_COPY,
  instanceLine,
  statusLine,
} from '../src/client/settings-layout.ts'

/** One copy function, as the section receives it. */
const english = (key: keyof typeof en): string => en[key]

/** The fields the schema lets the settings page edit. */
function volatileFields(): string[] {
  const dict = (Config as unknown as { dict: Record<string, { meta?: { volatile?: boolean } }> }).dict
  return Object.entries(dict)
    .filter(([, schema]) => schema.meta?.volatile === true)
    .map(([field]) => field)
    .sort()
}

/** The fields the page places. */
const placedFields = (): string[] => FIELD_PLACEMENTS.map(placement => placement.field).sort()

test('the page shows exactly the three choices a user makes', () => {
  assert.deepEqual(placedFields(), ['channel', 'headless', 'userDataDir'])
})

test('every volatile field is either on the page or deliberately hidden', () => {
  const named = [...placedFields(), ...HIDDEN_FIELDS].sort()
  assert.deepEqual(named, volatileFields(), 'a volatile field is neither placed nor hidden')
})

test('no field is both placed and hidden', () => {
  const hidden: readonly string[] = HIDDEN_FIELDS
  assert.deepEqual(placedFields().filter(field => hidden.includes(field)), [])
})

test('every field is placed once, so no control is rendered twice or dropped', () => {
  const fields = placedFields()
  assert.equal(new Set(fields).size, fields.length, 'a field is placed more than once')
  assert.ok(fields.length > 0)
})

test('a placed field is reachable from the list the page renders', () => {
  const rendered = FIELD_PLACEMENTS.map(placement => placement.field).sort()
  assert.deepEqual(rendered, placedFields())
})

test('every labelled row has copy in both shipped languages', () => {
  // A field keeps its words even while it is off the page: the hidden list is a
  // decision to stop asking, not a reason for two dictionaries to drift apart,
  // and re-exposing one must not need new copy.
  const rows: { label: DshBrowserKey; hint?: DshBrowserKey }[] = [
    ...Object.values(FIELD_COPY),
    PROFILE_DIR_COPY,
  ]
  for (const row of rows) {
    for (const key of [row.label, ...(row.hint === undefined ? [] : [row.hint])]) {
      assert.ok(key in en, `${key} is missing from English`)
      assert.ok(key in zh, `${key} is missing from Chinese`)
      assert.notEqual(en[key].trim(), '', `${key} is empty`)
    }
  }
  // A placed field with no copy would render a row with an empty label.
  for (const placement of FIELD_PLACEMENTS) {
    assert.notEqual(FIELD_COPY[placement.field], undefined, `${placement.field} has no copy`)
  }
})

test('the banner reports the strongest state among the running browsers', () => {
  const ready = { maxInstances: 4, instances: [status({ state: 'ready' }), status({ state: 'starting' })] }
  assert.equal(statusLine(ready, english), '1 session browser(s) running')
  assert.equal(statusLine({ maxInstances: 4, instances: [status({ state: 'starting' })] }, english), '1 session browser(s) starting')
  assert.equal(statusLine({ maxInstances: 4, instances: [] }, english), en.settingsStatusNone)
  assert.equal(statusLine(undefined, english), en.settingsStatusReading)
})

test('a session line names the session, its state, and only the facts it has', () => {
  const line = instanceLine(status({
    state: 'ready',
    debugPort: 9334,
    mode: 'headless',
    tabs: [
      { index: 0, url: 'https://example.com/', active: true },
      { index: 1, url: 'https://example.com/b', active: false },
    ],
  }), english)
  assert.ok(line.includes('127.0.0.1:9334'), line)
  assert.ok(line.includes('headless'), line)
  assert.ok(line.includes('2 page(s)'), line)
  assert.ok(!line.includes('session-'), `the raw session id leaked into "${line}"`)

  const stopped = instanceLine(status({ state: 'closed' }), english)
  assert.ok(stopped.includes(en.settingsInstanceStateStopped), stopped)
  assert.ok(!stopped.includes('CDP'), stopped)

  const failed = instanceLine(status({ state: 'failed', error: 'port in use' }), english)
  assert.ok(failed.includes('port in use'), failed)
})

/** One instance of the host's report, with the fields a case cares about. */
function status(fields: Partial<ClientBrowserStatus>): ClientBrowserStatus {
  return { sessionId: 'session-abcdef123456', state: 'idle', ...fields }
}
