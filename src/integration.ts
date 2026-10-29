import { Inject, Injectable, NgZone } from '@angular/core'
import { AppService, ConfigService, HostWindowService } from 'tabby-core'
import { BaseSession, BaseTerminalTabComponent, TerminalDecorator } from 'tabby-terminal'
import { Subscription } from 'rxjs'
import { thresholdSeconds } from './detector'
import { SessionMonitor } from './session-monitor'

interface PaneState {
    enabled: boolean
    session?: BaseSession
    monitor?: SessionMonitor
    notification?: Notification
    subscriptions: Subscription
}

@Injectable()
export class SilenceDecorator extends TerminalDecorator {
    // Weak keys plus subscriptions scoped to detach: no global terminal registry.
    private panes = new WeakMap<BaseTerminalTabComponent<any>, PaneState>()
    private nextID = 0

    constructor (
        @Inject(ConfigService) private config: ConfigService,
        @Inject(AppService) private app: AppService,
        @Inject(HostWindowService) private hostWindow: HostWindowService,
        @Inject(NgZone) private zone: NgZone,
    ) { super() }

    attach (tab: BaseTerminalTabComponent<any>): void {
        if (this.panes.has(tab)) { return }
        const state: PaneState = {
            enabled: this.config.store.silenceMonitor?.autoMonitor === true,
            subscriptions: new Subscription(),
        }
        const id = ++this.nextID
        this.panes.set(tab, state)
        const bind = (session: BaseSession | null) => {
            if (state.session === session) { return }
            state.monitor?.dispose()
            state.monitor = undefined
            state.session = session ?? undefined
            if (session) {
                state.monitor = new SessionMonitor(session, this.threshold(), state.enabled, () => {
                    tab.displayActivity()
                    this.showNotification(tab, state, id)
                }, undefined, () => {
                    this.clearNotification(state)
                    state.session = undefined
                    state.monitor = undefined
                })
            }
        }
        state.subscriptions.add(tab.sessionChanged$.subscribe(bind))
        state.subscriptions.add(tab.destroyed$.subscribe(() => this.detach(tab)))
        state.subscriptions.add(this.config.changed$.subscribe(() => state.monitor?.setThreshold(this.threshold())))
        bind(tab.session)
    }

    detach (tab: BaseTerminalTabComponent<any>): void {
        const state = this.panes.get(tab)
        if (state) {
            this.clearNotification(state)
            state.subscriptions.unsubscribe()
            state.monitor?.dispose()
            state.monitor = undefined
            state.session = undefined
            this.panes.delete(tab)
        }
        super.detach(tab)
    }

    isEnabled (tab: BaseTerminalTabComponent<any>): boolean { return this.panes.get(tab)?.enabled ?? false }

    toggle (tab: BaseTerminalTabComponent<any>): void {
        this.attach(tab)
        const state = this.panes.get(tab)!
        state.enabled = !state.enabled
        state.monitor?.setEnabled(state.enabled)
        if (!state.enabled) { this.clearNotification(state) }
    }

    private showNotification (tab: BaseTerminalTabComponent<any>, state: PaneState, id: number): void {
        this.clearNotification(state)
        const session = state.session
        try {
            const notification = new Notification('Terminal silence', {
                body: `${tab.customTitle || tab.title || 'Terminal'} (pane ${id}): no output for ${this.threshold()} seconds.`,
            })
            state.notification = notification
            notification.onclick = () => this.zone.run(() => {
                if (this.panes.get(tab) !== state || state.session !== session || state.notification !== notification) { return }
                // Resolve the current parent: the pane may have moved since the alert.
                const parent = this.app.getParentTab(tab)
                const root = parent ?? tab
                if (!this.app.tabs.includes(root)) { return }
                this.app.selectTab(root)
                parent?.focus(tab)
                this.hostWindow.bringToFront()
                this.clearNotification(state)
            })
            const release = () => {
                notification.onclick = null
                notification.onclose = null
                notification.onerror = null
                if (state.notification === notification) { state.notification = undefined }
            }
            notification.onclose = release
            notification.onerror = release
        } catch {
            // OS may refuse notifications; the activity marker remains.
        }
    }

    private clearNotification (state: PaneState): void {
        const notification = state.notification
        state.notification = undefined
        if (!notification) { return }
        // Remove closures before close(), including when Windows keeps history.
        notification.onclick = null
        notification.onclose = null
        notification.onerror = null
        try { notification.close() } catch { /* Already dismissed by the OS. */ }
    }

    private threshold (): number { return thresholdSeconds(this.config.store.silenceMonitor?.thresholdSeconds) }

}
