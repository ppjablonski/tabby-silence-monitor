import assert from 'node:assert/strict'
import { harness } from '../test/helpers'
import { verifyDiscovery } from '../test/discovery'

async function main (): Promise<void> {
    await verifyDiscovery(process.argv[2])
    const h = harness(process.argv[2])
    assert.equal(typeof h.exports.default, 'function')
    assert.equal(Object.keys(h.exports).join(','), 'default')
    assert.equal(h.capturedModules.length, 1)
    const providers = h.capturedModules[0].providers
    const decoratorProvider = providers.find((p: any) => p.provide === h.terminal.TerminalDecorator)
    assert.ok(decoratorProvider?.useExisting, 'one shared decorator instance is used by menu and host')
    const config = new h.ConfigService()
    const decorator = new decoratorProvider.useExisting(config, h.app, h.hostWindow, h.zone)
    const tab = new h.terminal.BaseTerminalTabComponent()
    const session = new h.Session()
    tab.setSession(session)
    decorator.attach(tab)
    session.middleware.feedFromSession(Buffer.from('synthetic test data'))
    h.clock.tick(4999)
    assert.equal(h.notifications.length, 0)
    h.clock.tick(1)
    assert.equal(h.notifications.length, 1)
    assert.equal(tab.markers, 1)
    h.clock.tick(10000)
    assert.equal(h.notifications.length, 1)
    h.app.tabs.push(tab)
    h.notifications[0].click()
    assert.equal(h.app.activeTab, tab)
    assert.equal(h.hostWindow.presentations, 1)
    assert.equal(h.notifications[0].onclick, null)
    decorator.detach(tab)
    assert.equal(config.changed$.observers.length, 0)
    assert.equal(h.clock.tasks.size, 0)
    console.log('Extracted production bundle: actual Tabby discovery, host imports, module registration and detector smoke test passed')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
