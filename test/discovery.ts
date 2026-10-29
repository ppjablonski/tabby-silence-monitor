import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

/** Execute the actual 1.0.238 discovery functions, without its global require hooks. */
export function discovery () {
    const source = fs.readFileSync(path.join(__dirname, 'fixtures/tabby-plugins.ts'), 'utf8')
    const tree = ts.createSourceFile('plugins.ts', source, ts.ScriptTarget.Latest, true)
    const names = ['getCandidateLocationsInPluginDir', 'parsePluginInfo']
    const functions = tree.statements.filter(node => ts.isFunctionDeclaration(node)
        && node.name && names.includes(node.name.text))
    if (functions.length !== names.length) { throw new Error('Missing upstream discovery functions') }
    const js = ts.transpileModule(functions.map(node => node.getText(tree)).join('\n'), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText
    const errors: string[] = []
    const context = vm.createContext({
        fs: { ...fs.promises, exists: async (filename: string) => fs.existsSync(filename) },
        path,
        PLUGIN_PREFIX: 'tabby-', LEGACY_PLUGIN_PREFIX: 'terminus-',
        PLUGIN_BLACKLIST: [], builtinPluginsPath: '/test/builtin-plugins',
        console: { log: () => undefined, error: (...args: string[]) => errors.push(args.join(' ')) },
    })
    vm.runInContext(js, context)
    return {
        candidates: context.getCandidateLocationsInPluginDir as (dir: string) => Promise<{ pluginDir: string, packageName: string }[]>,
        parse: context.parsePluginInfo as (dir: string, name: string) => Promise<any>,
        errors,
    }
}

export async function verifyDiscovery (entry: string): Promise<void> {
    const plugin = path.dirname(path.dirname(entry))
    const loader = discovery()
    const candidates = await loader.candidates(path.dirname(plugin))
    const candidate = candidates.find(item => item.packageName === path.basename(plugin))
    if (!candidate) { throw new Error('Tabby 1.0.238 did not discover the extracted plugin') }
    const info = await loader.parse(candidate.pluginDir, candidate.packageName)
    if (!info) { throw new Error(`Tabby 1.0.238 rejected plugin metadata: ${loader.errors.join('; ')}`) }
    if (path.resolve(info.path, info.info.main) !== path.resolve(entry)) {
        throw new Error('Discovered plugin entry differs from the packaged entry')
    }
}
