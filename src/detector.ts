export interface Clock {
    set (callback: () => void, delay: number): unknown
    clear (handle: unknown): void
}

const systemClock: Clock = {
    set: (callback, delay) => setTimeout(callback, delay),
    clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export function thresholdSeconds (value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(3600, Math.max(1, value)) : 5
}

/** No data is accepted or retained here: activity is just an event. */
export class SilenceDetector {
    private timer: unknown
    private disposed = false

    constructor (
        private notify: () => void,
        private threshold = 5,
        private enabled = true,
        private clock: Clock = systemClock,
    ) { }

    activity (): void {
        if (this.disposed || !this.enabled) { return }
        this.cancel()
        this.timer = this.clock.set(() => {
            this.timer = undefined
            this.notify()
        }, thresholdSeconds(this.threshold) * 1000)
    }

    setEnabled (enabled: boolean): void {
        this.enabled = enabled
        if (!enabled) { this.cancel() }
    }

    setThreshold (seconds: number): void {
        this.threshold = thresholdSeconds(seconds)
        // A pending period restarts from the settings change; a notified period
        // stays silent until new output. This never invents initial activity.
        if (this.timer !== undefined) { this.activity() }
    }

    dispose (): void {
        this.cancel()
        this.disposed = true
        this.notify = () => undefined
    }

    private cancel (): void {
        if (this.timer !== undefined) {
            this.clock.clear(this.timer)
            this.timer = undefined
        }
    }
}
