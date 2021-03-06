# -*- mode: python -*-

import platform
system = platform.system()
block_cipher = None

binaries      = [('externals/nanonet/nanonet*.so', '.')]
datas         = [('externals/nanonet/nanonet/data/*', 'externals/nanonet/nanonet/data')]
hiddenimports = []

if system == 'Darwin':
    # there is a hook for this h5py but seems not to work (on OSX at least)
    hiddenimports += [
        'h5py.{}'.format(x) for x in ['_proxy', 'utils', 'defs', 'h5ac']
    ]

a = Analysis(['api.py'],
             pathex=[],
             binaries=binaries,
             datas=datas,
             hiddenimports=hiddenimports,
             hookspath=[],
             runtime_hooks=[],
             excludes=[],
             win_no_prefer_redirects=False,
             win_private_assemblies=False,
             cipher=block_cipher)
pyz = PYZ(a.pure, a.zipped_data,
             cipher=block_cipher)
exe = EXE(pyz,
          a.scripts,
          exclude_binaries=True,
          name='api',
          debug=False,
          strip=False,
          upx=True,
          console=True )
coll = COLLECT(exe,
               a.binaries,
               a.zipfiles,
               a.datas,
               strip=False,
               upx=True,
               name='api')
