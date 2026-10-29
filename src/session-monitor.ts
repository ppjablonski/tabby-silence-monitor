import { Subscription } from 'rxjs'
import { BaseSession, SessionMiddleware } from 'tabby-terminal'
import { Clock, SilenceDetector } from './detector'

/** A synchronous observer at the raw session edge, before control processing. */
export class ActivityMiddleware extends SessionMiddleware {
    constructor (private detector: SilenceDetector) { super() }

    feedFromSession (data: Buffer): void {
        if (data.length) { this.detector.activity() }
        super.feedFromSession(data)
    }

    close (): void {
        this.detector.dispose()
        super.close()
    }
}

export class SessionMonitor {
    private detector: SilenceDetector
    private observer: ActivityMiddleware
    private subscriptions = new Subscription()
    private disposed = false
    private session: BaseSession | undefined

    constructor (session: BaseSession, threshold: number, enabled: boolean, notify: () => void, clock?: Clock, private onDispose: () => void = () => undefined) {
        this.session = session
        this.detector = new SilenceDetector(notify, threshold, enabled, clock)
        this.observer = new ActivityMiddleware(this.detector)
        session.middleware.unshift(this.observer)
        // Handle both emissions and completion (destroy() may complete without
        // emitting destroyed$ when the session was never opened).
        const stop = () => this.dispose()
        this.subscriptions.add(session.closed$.subscribe({ next: stop, complete: stop }))
        this.subscriptions.add(session.destroyed$.subscribe({ next: stop, complete: stop }))
    }

    setEnabled (value: boolean): void { this.detector.setEnabled(value) }
    setThreshold (value: number): void { this.detector.setThreshold(value) }

    dispose (): void {
        if (this.disposed) { return }
        this.disposed = true
        this.subscriptions.unsubscribe()
        this.detector.dispose()
        const session = this.session
        this.session = undefined
        session?.middleware.remove(this.observer)
        this.observer.close()
        this.onDispose()
        this.onDispose = () => undefined
    }
}
