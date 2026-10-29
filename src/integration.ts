import { Inject, Injectable } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { BaseSession, BaseTerminalTabComponent, TerminalDecorator } from 'tabby-terminal'
import { Subscription } from 'rxjs'
import { thresholdSeconds } from './detector'
import { SessionMonitor } from './session-monitor'

interface PaneState {
    enabled: boolean
    session?: BaseSession
    monitor?: SessionMonitor
    subscriptions: Subscription
}

@Injectable()
export class SilenceDecorator extends TerminalDecorator {
    // Weak keys plus subscriptions scoped to detach: no global terminal registry.
    private panes = new WeakMap<BaseTerminalTabComponent<any>, PaneState>()
    private nextID = 0

    constructor (@Inject(ConfigService) private config: ConfigService) { super() }

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
                    // Same renderer Notification API as Tabby's built-in menu.
                    // No notification object or terminal content is retained.
                    try {
                        new Notification('Terminal silence', {
                            body: `${tab.customTitle || tab.title || 'Terminal'} (pane ${id}): no output for ${this.threshold()} seconds.`,
                        })
                    } catch {
                        // OS may refuse notifications; the activity marker remains.
                    }
                }, undefined, () => {
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
    }

    private threshold (): number { return thresholdSeconds(this.config.store.silenceMonitor?.thresholdSeconds) }

}
