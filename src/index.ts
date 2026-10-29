import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Component, Inject, Injectable, NgModule } from '@angular/core'
import TabbyCoreModule, { BaseTabComponent, ConfigProvider, ConfigService, MenuItemOptions, TabContextMenuItemProvider } from 'tabby-core'
import { BaseTerminalTabComponent, TerminalDecorator } from 'tabby-terminal'
import { SettingsTabProvider } from 'tabby-settings'
import { SilenceDecorator } from './integration'
import { thresholdSeconds } from './detector'

@Injectable()
class SilenceConfig extends ConfigProvider {
    defaults = { silenceMonitor: { thresholdSeconds: 5, autoMonitor: false } }
}

@Injectable()
class SilenceMenu extends TabContextMenuItemProvider {
    constructor (@Inject(SilenceDecorator) private monitor: SilenceDecorator) { super() }
    async getItems (tab: BaseTabComponent): Promise<MenuItemOptions[]> {
        if (!(tab instanceof BaseTerminalTabComponent)) { return [] }
        return [{
            label: 'Monitor terminal silence',
            type: 'checkbox',
            checked: this.monitor.isEnabled(tab),
            click: () => this.monitor.toggle(tab),
        }]
    }
}

@Component({
    template: `
        <h3>Silence Monitor</h3>
        <p>Notify once when received terminal output stops. New output rearms monitoring.</p>
        <label for="silence-threshold">Silence threshold (seconds, 1–3600)</label>
        <input id="silence-threshold" class="form-control" type="number" min="1" max="3600"
            [ngModel]="seconds" (ngModelChange)="updateThreshold($event)">
        <label class="mt-3">
            <input type="checkbox" [ngModel]="autoMonitor" (ngModelChange)="updateAuto($event)">
            Automatically monitor newly initialized terminal panes
        </label>
        <p class="mt-3">Enable or disable each pane from its terminal context menu.
        Automatic monitoring changes apply to new panes. Enabling waits for the next output.</p>
    `,
})
class SilenceSettings {
    seconds: number
    autoMonitor: boolean
    constructor (@Inject(ConfigService) private config: ConfigService) {
        this.seconds = thresholdSeconds(config.store.silenceMonitor.thresholdSeconds)
        this.autoMonitor = config.store.silenceMonitor.autoMonitor === true
    }
    updateThreshold (value: unknown): void {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 3600) { return }
        this.seconds = thresholdSeconds(value)
        this.config.store.silenceMonitor.thresholdSeconds = this.seconds
        void this.config.save()
    }
    updateAuto (value: boolean): void {
        this.autoMonitor = value
        this.config.store.silenceMonitor.autoMonitor = value
        void this.config.save()
    }
}

@Injectable()
class SilenceSettingsProvider extends SettingsTabProvider {
    id = 'silence-monitor'
    icon = 'fas fa-hourglass-half'
    title = 'Silence Monitor'
    getComponentType (): typeof SilenceSettings { return SilenceSettings }
}

@NgModule({
    imports: [CommonModule, FormsModule, TabbyCoreModule],
    declarations: [SilenceSettings],
    providers: [
        SilenceDecorator,
        { provide: TerminalDecorator, useExisting: SilenceDecorator, multi: true },
        { provide: TabContextMenuItemProvider, useClass: SilenceMenu, multi: true },
        { provide: ConfigProvider, useClass: SilenceConfig, multi: true },
        { provide: SettingsTabProvider, useClass: SilenceSettingsProvider, multi: true },
    ],
})
export default class SilenceMonitorModule { }
