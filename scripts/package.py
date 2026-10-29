"""Build a dependency-free ZIP and verify the extracted module on Linux."""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import zipfile

root = Path(__file__).resolve().parent.parent
metadata = json.loads((root / 'package.json').read_text())
name = metadata['name']
version = metadata['version']
prefix = f'node_modules/{name}'
files = ['package.json', 'dist/index.js', 'README.md', 'PLAN.md', 'WINDOWS-TESTS.md', 'LICENSE']
# Development dependencies and build commands have no role in the installed package.
runtime_metadata = {key: metadata[key] for key in
                    ['name', 'version', 'description', 'license', 'keywords', 'main']}
release = root / 'release'
release.mkdir(exist_ok=True)
archive = release / f'{name}-{version}-windows.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as package:
    for filename in files:
        data = ((json.dumps(runtime_metadata, indent=2) + '\n').encode()
                if filename == 'package.json' else (root / filename).read_bytes())
        info = zipfile.ZipInfo(f'{prefix}/{filename}', date_time=(2026, 1, 1, 0, 0, 0))
        info.external_attr = 0o100644 << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        package.writestr(info, data)
with zipfile.ZipFile(archive) as package:
    assert set(package.namelist()) == {f'{prefix}/{filename}' for filename in files}
    assert package.testzip() is None
    with tempfile.TemporaryDirectory(prefix='silence-package-') as extracted:
        package.extractall(extracted)
        plugin = Path(extracted) / 'node_modules' / name
        installed = json.loads((plugin / 'package.json').read_text())
        assert installed['name'].startswith('tabby-')
        assert 'tabby-plugin' in installed['keywords']
        assert installed['version'] == version
        assert (plugin / installed['main']).is_file()
        assert not installed.get('dependencies') and not installed.get('scripts')
        subprocess.run(['node', '--import', 'tsx', 'scripts/smoke-package.ts',
                        str(plugin / installed['main'])], cwd=root, check=True)
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256').write_text(f'{digest}  {archive.name}\n')
print(f'Verified: {archive} ({archive.stat().st_size} bytes)')
print(f'SHA-256: {digest}')
