import { test } from 'node:test'
import assert from 'node:assert/strict'
import { harness } from './helpers'

function setup () {
    const h = harness()
    const { SilenceDecorator } = h.load('src/integration.ts')
    const decorator = new SilenceDecorator(new h.ConfigService(), h.app, h.hostWindow, h.zone)
    function pane () {
        const tab = new h.terminal.BaseTerminalTabComponent()
        const session = new h.Session()
        tab.setSession(session)
        decorator.attach(tab)
        return { tab, session }
    }
    function split (...tabs: any[]) {
        return { tabs, focused: null as any, getAllTabs () { return this.tabs }, focus (tab: any) { this.focused = tab } }
    }
    return { ...h, decorator, pane, split }
}

test('click selects the split root, focuses the specific pane and presents its window in Angular zone', () => {
    const h = setup()
    const a = h.pane(); const b = h.pane()
    const root = h.split(a.tab, b.tab)
    h.app.tabs.push(root)
    b.session.middleware.feedFromSession(Buffer.from('activity'))
    h.clock.tick(5000)
    assert.equal(h.app.selections.length, 0, 'notification alone must not steal focus')
    h.notifications[0].click()
    assert.equal(h.app.activeTab, root)
    assert.equal(root.focused, b.tab)
    assert.equal(h.hostWindow.presentations, 1)
    assert.equal(h.zone.runs, 1)
    assert.equal(h.notifications[0].closed, true)
    assert.equal(h.notifications[0].onclick, null)
    h.decorator.detach(a.tab); h.decorator.detach(b.tab)
})

test('several notifications each target their own pane in click order; raw tabs also work', () => {
    const h = setup()
    const a = h.pane(); const b = h.pane()
    const root = h.split(a.tab)
    h.app.tabs.push(root, b.tab)
    a.session.middleware.feedFromSession(Buffer.from('a'))
    b.session.middleware.feedFromSession(Buffer.from('b'))
    h.clock.tick(5000)
    h.notifications[1].click()
    assert.equal(h.app.activeTab, b.tab)
    h.notifications[0].click()
    assert.equal(h.app.activeTab, root)
    assert.equal(root.focused, a.tab)
    assert.equal(h.hostWindow.presentations, 2)
    h.decorator.detach(a.tab); h.decorator.detach(b.tab)
})

test('notification resolves current parent after pane moves; removed panes cannot be selected', () => {
    const h = setup()
    const a = h.pane()
    const oldRoot = h.split(a.tab); const newRoot = h.split()
    h.app.tabs.push(oldRoot, newRoot)
    a.session.middleware.feedFromSession(Buffer.from('a')); h.clock.tick(5000)
    oldRoot.tabs = []; newRoot.tabs = [a.tab]
    h.notifications[0].click()
    assert.equal(h.app.activeTab, newRoot)
    assert.equal(newRoot.focused, a.tab)
    a.session.middleware.feedFromSession(Buffer.from('a')); h.clock.tick(5000)
    newRoot.tabs = []
    h.notifications[1].click()
    assert.equal(h.hostWindow.presentations, 1)
    h.decorator.detach(a.tab)
})

for (const reason of ['detach', 'close', 'replace', 'disable', 'supersede', 'dismiss']) {
    test(`${reason} releases click handlers; stale callbacks cannot focus a pane`, () => {
        const h = setup()
        const a = h.pane()
        h.app.tabs.push(a.tab)
        a.session.middleware.feedFromSession(Buffer.from('a')); h.clock.tick(5000)
        const notification = h.notifications[0]
        const staleClick = notification.onclick!
        if (reason === 'detach') { h.decorator.detach(a.tab) }
        if (reason === 'close') { a.session.closed$.next() }
        if (reason === 'replace') { a.tab.setSession(new h.Session()) }
        if (reason === 'disable') { h.decorator.toggle(a.tab) }
        if (reason === 'supersede') {
            a.session.middleware.feedFromSession(Buffer.from('a')); h.clock.tick(5000)
        }
        if (reason === 'dismiss') { notification.close() }
        assert.equal(notification.closed, true)
        assert.equal(notification.onclick, null)
        assert.equal(notification.onclose, null)
        assert.equal(notification.onerror, null)
        staleClick()
        assert.equal(h.hostWindow.presentations, 0)
        assert.equal(h.app.selections.length, 0)
        h.decorator.detach(a.tab)
    })
}

test('a notification in another window activates only that window', () => {
    const first = setup(); const second = setup()
    const a = first.pane(); const b = second.pane()
    first.app.tabs.push(a.tab); second.app.tabs.push(b.tab)
    a.session.middleware.feedFromSession(Buffer.from('a'))
    b.session.middleware.feedFromSession(Buffer.from('b'))
    first.clock.tick(5000); second.clock.tick(5000)
    second.notifications[0].click()
    assert.equal(second.hostWindow.presentations, 1)
    assert.equal(second.app.activeTab, b.tab)
    assert.equal(first.hostWindow.presentations, 0)
    assert.equal(first.app.activeTab, null)
    first.decorator.detach(a.tab); second.decorator.detach(b.tab)
})
