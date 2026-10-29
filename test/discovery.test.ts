import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { discovery } from './discovery'

test('actual Tabby loader rejects missing author (0.1.0 regression) and accepts complete metadata', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'silence-discovery-'))
    try {
        const metadata = JSON.parse(await fs.readFile('package.json', 'utf8'))
        const plugin = path.join(directory, metadata.name)
        await fs.mkdir(plugin)
        const { author, ...missingAuthor } = metadata
        await fs.writeFile(path.join(plugin, 'package.json'), JSON.stringify(missingAuthor))
        const loader = discovery()
        const candidates = await loader.candidates(directory)
        assert.equal(candidates.length, 1)
        assert.equal(await loader.parse(directory, metadata.name), null)
        assert.match(loader.errors[0], /Cannot load package info/)
        assert.ok(author, 'plugin metadata must include author for Tabby 1.0.238')
        await fs.writeFile(path.join(plugin, 'package.json'), JSON.stringify(metadata))
        const info = await loader.parse(directory, metadata.name)
        assert.ok(info, 'current manifest is accepted by the actual loader')
        assert.equal(info.name, 'silence-monitor')
        assert.equal(info.version, metadata.version)
        assert.equal(info.author, metadata.author)
    } finally {
        await fs.rm(directory, { recursive: true, force: true })
    }
})
