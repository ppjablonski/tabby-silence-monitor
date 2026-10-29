import { test } from 'node:test'
import assert from 'node:assert/strict'
import { harness } from './helpers'

test('raw middleware preserves Buffer identity, counts control bytes, ignores empty output and input', () => {
    const h = harness()
    const { SessionMonitor } = h.load('src/session-monitor.ts')
    const session = new h.Session()
    let hits = 0
    new SessionMonitor(session, 5, true, () => hits++, h.clock)
    const output: Buffer[] = []; const input: Buffer[] = []
    session.middleware.outputToTerminal$.subscribe((x: Buffer) => output.push(x))
    session.middleware.outputToSession$.subscribe((x: Buffer) => input.push(x))
    const keys = Buffer.from('keyboard')
    session.middleware.feedFromTerminal(keys)
    session.middleware.feedFromSession(Buffer.alloc(0))
    h.clock.tick(5000); assert.equal(hits, 0); assert.equal(input[0], keys)
    const bytes = Buffer.from([0x1b, 0x5b, 0x30, 0x6d, 0, 255])
    session.middleware.feedFromSession(bytes)
    assert.equal(output[1], bytes)
    h.clock.tick(4000); session.middleware.feedFromTerminal(keys)
    h.clock.tick(1000); assert.equal(hits, 1)
    h.clock.tick(10000); assert.equal(hits, 1)
})

for (const event of ['closed', 'destroyed', 'complete', 'dispose', 'middleware-close']) {
    test(`${event} releases timers, lifecycle subscriptions and middleware`, () => {
        const h = harness()
        const { SessionMonitor } = h.load('src/session-monitor.ts')
        const session = new h.Session()
        let hits = 0; let disposed = 0
        const monitor = new SessionMonitor(session, 5, true, () => hits++, h.clock, () => disposed++)
        session.middleware.feedFromSession(Buffer.from('activity'))
        if (event === 'closed') { session.closed$.next() }
        if (event === 'destroyed') { session.destroyed$.next() }
        if (event === 'complete') { session.destroyed$.complete() }
        if (event === 'dispose') { monitor.dispose() }
        if (event === 'middleware-close') { session.middleware.close(); monitor.dispose() }
        monitor.dispose()
        assert.equal(h.clock.tasks.size, 0)
        assert.equal(session.closed$.observers.length, 0)
        assert.equal(session.destroyed$.observers.length, 0)
        assert.equal(disposed, 1)
        assert.equal((monitor as any).session, undefined)
        h.clock.tick(10000); assert.equal(hits, 0)
        // Other subscribers can still receive unchanged output after removal.
        if (event !== 'middleware-close') {
            const bytes = Buffer.from('next'); let received: Buffer | undefined
            session.middleware.outputToTerminal$.subscribe((x: Buffer) => received = x)
            session.middleware.feedFromSession(bytes); assert.equal(received, bytes)
        }
    })
}

test('decorator handles duplicate attachment, split panes, replacement, disable and detach', () => {
    const h = harness()
    const { SilenceDecorator } = h.load('src/integration.ts')
    const config = new h.ConfigService()
    const decorator = new SilenceDecorator(config)
    const a = new h.terminal.BaseTerminalTabComponent()
    const b = new h.terminal.BaseTerminalTabComponent()
    const old = new h.Session(); const second = new h.Session()
    a.setSession(old); b.setSession(second)
    decorator.attach(a); decorator.attach(a); decorator.attach(b)
    assert.equal(a.sessionChanged$.observers.length, 1)
    old.middleware.feedFromSession(Buffer.from('a'))
    h.clock.tick(3000); second.middleware.feedFromSession(Buffer.from('b'))
    h.clock.tick(2000); assert.equal(h.notifications.length, 1)
    assert.equal(a.markers, 1); assert.equal(b.markers, 0)
    h.clock.tick(3000); assert.equal(h.notifications.length, 2)
    assert.match(h.notifications[0].body, /Test terminal \(pane 1\)/)
    old.middleware.feedFromSession(Buffer.from('a'))
    const replacement = new h.Session()
    a.setSession(replacement)
    assert.equal(old.closed$.observers.length, 0)
    h.clock.tick(5000); assert.equal(h.notifications.length, 2)
    old.middleware.feedFromSession(Buffer.from('stale'))
    replacement.middleware.feedFromSession(Buffer.from('new'))
    decorator.toggle(a)
    h.clock.tick(5000); assert.equal(h.notifications.length, 2)
    decorator.toggle(a); h.clock.tick(5000); assert.equal(h.notifications.length, 2)
    replacement.middleware.feedFromSession(Buffer.from('new'))
    h.clock.tick(5000); assert.equal(h.notifications.length, 3)
    replacement.middleware.feedFromSession(Buffer.from('new'))
    decorator.detach(a); b.destroyed$.next()
    assert.equal(config.changed$.observers.length, 0)
    assert.equal(a.sessionChanged$.observers.length, 0)
    assert.equal(a.destroyed$.observers.length, 0)
    assert.equal(replacement.destroyed$.observers.length, 0)
    assert.equal(h.clock.tasks.size, 0)
})

test('settings changes affect pending timers without enabling existing panes', () => {
    const h = harness()
    const { SilenceDecorator } = h.load('src/integration.ts')
    const config = new h.ConfigService()
    config.store.silenceMonitor.autoMonitor = false
    const decorator = new SilenceDecorator(config)
    const tab = new h.terminal.BaseTerminalTabComponent()
    const session = new h.Session()
    decorator.attach(tab); tab.setSession(session)
    config.store.silenceMonitor.autoMonitor = true; config.changed$.next()
    session.middleware.feedFromSession(Buffer.from('ignored'))
    h.clock.tick(5000); assert.equal(h.notifications.length, 0)
    decorator.toggle(tab)
    session.middleware.feedFromSession(Buffer.from('active'))
    config.store.silenceMonitor.thresholdSeconds = 1; config.changed$.next()
    h.clock.tick(1000); assert.equal(h.notifications.length, 1)
    session.closed$.next()
    assert.equal(h.clock.tasks.size, 0)
    decorator.detach(tab)
})

test('observation precedes downstream control filtering and excludes synthesized local echo', () => {
    const h = harness()
    const { SessionMonitor } = h.load('src/session-monitor.ts')
    const session = new h.Session()
    class FilteringEcho extends h.terminal.SessionMiddleware {
        feedFromSession () { /* simulate an OSC processor consuming the chunk */ }
        feedFromTerminal (data: Buffer) {
            this.outputToTerminal.next(data)
            super.feedFromTerminal(data)
        }
    }
    session.middleware.push(new FilteringEcho())
    let hits = 0
    new SessionMonitor(session, 5, true, () => hits++, h.clock)
    session.middleware.feedFromTerminal(Buffer.from('local echo'))
    h.clock.tick(5000); assert.equal(hits, 0)
    session.middleware.feedFromSession(Buffer.from('\x1b]0;title\x07'))
    h.clock.tick(5000); assert.equal(hits, 1)
})
