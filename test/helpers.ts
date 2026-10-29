import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import * as rxjs from 'rxjs'

export class FakeClock {
    now = 0
    next = 0
    tasks = new Map<number, { at: number, callback: () => void }>()
    set = (callback: () => void, delay: number): number => {
        this.tasks.set(++this.next, { at: this.now + delay, callback })
        return this.next
    }
    clear = (handle: unknown): void => { this.tasks.delete(handle as number) }
    tick (ms: number): void {
        this.now += ms
        for (const [id, task] of this.tasks) {
            if (task.at <= this.now) { this.tasks.delete(id); task.callback() }
        }
    }
}

export function harness (bundle?: string) {
    const clock = new FakeClock()
    const notifications: { title: string, body: string }[] = []
    const capturedModules: any[] = []
    const components: any[] = []
    class SubscriptionContainer {
        subscriptions: rxjs.Subscription[] = []
        subscribe (observable: any, handler: any) { this.subscriptions.push(observable.subscribe(handler)) }
        cancelAll () { this.subscriptions.forEach(s => s.unsubscribe()); this.subscriptions = [] }
    }
    class ConfigService {
        store = { silenceMonitor: { thresholdSeconds: 5, autoMonitor: true } }
        changed$ = new rxjs.Subject<void>()
        save () { this.changed$.next(); return Promise.resolve() }
    }
    const core = { SubscriptionContainer, ConfigService, ConfigProvider: class {}, TabContextMenuItemProvider: class {}, default: class {} }
    const cache = new Map<string, any>()
    let terminal: any
    const angular = {
        Inject: () => () => undefined,
        Injectable: () => (target: any) => target,
        Component: (meta: any) => (target: any) => { components.push({ target, meta }); return target },
        NgModule: (meta: any) => (target: any) => { capturedModules.push(meta); return target },
    }
    function execute (filename: string, source: string) {
        const module = { exports: {} as any }
        cache.set(filename, module)
        vm.runInNewContext(source, {
            module, exports: module.exports, Buffer,
            setTimeout: clock.set, clearTimeout: clock.clear,
            Notification: class {
                constructor (title: string, options: { body: string }) { notifications.push({ title, body: options.body }) }
            },
            require: (id: string) => {
                if (id === 'rxjs') { return rxjs }
                if (id === 'tabby-core') { return core }
                if (id === 'tabby-terminal') { return terminal }
                if (id === '@angular/core') { return angular }
                if (id === '@angular/common') { return { CommonModule: class {} } }
                if (id === '@angular/forms') { return { FormsModule: class {} } }
                if (id === 'tabby-settings') { return { SettingsTabProvider: class {} } }
                if (id.startsWith('.')) { return load(path.resolve(path.dirname(filename), id + '.ts')) }
                throw new Error(`Unexpected runtime import: ${id}`)
            },
        }, { filename })
        return module.exports
    }
    function load (filename: string): any {
        filename = path.resolve(filename)
        if (cache.has(filename)) { return cache.get(filename).exports }
        const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
        }).outputText
        return execute(filename, source)
    }
    const middleware = load('test/fixtures/tabby-middleware.ts')
    class TerminalDecorator { detach () {} }
    class BaseTerminalTabComponent {
        session: any = null
        sessionChanged$ = new rxjs.Subject<any>()
        destroyed$ = new rxjs.Subject<void>()
        title = 'Test terminal'
        customTitle = ''
        markers = 0
        displayActivity () { this.markers++ }
        setSession (session: any) { this.session = session; this.sessionChanged$.next(session) }
    }
    terminal = { ...middleware, TerminalDecorator, BaseTerminalTabComponent }
    class Session {
        middleware = new middleware.SessionMiddlewareStack()
        closed$ = new rxjs.Subject<void>()
        destroyed$ = new rxjs.Subject<void>()
    }
    const exports = bundle ? execute(path.resolve(bundle), fs.readFileSync(bundle, 'utf8')) : undefined
    return { clock, notifications, load, terminal, Session, ConfigService, capturedModules, components, exports }
}
