npm_config_target=$(shell jq -r '.devDependencies.electron' < package.json | perl -pe 's/[^\d.]+//g') # electron version
npm_config_arch=x64
npm_config_target_arch=x64
npm_config_disturl=https://atom.io/download/electron
npm_config_runtime=electron
npm_config_build_from_source=true

MAJOR   ?= $(shell jq -r '.version' < package.json | cut -d . -f 1)
MINOR   ?= $(shell jq -r '.version' < package.json | cut -d . -f 2)
SUB     ?= $(shell jq -r '.version' < package.json | cut -d . -f 3)
PATCH   ?= 1
VERSION = $(MAJOR).$(MINOR).$(SUB).$(PATCH)
OS      ?= $(shell uname -s)

ifeq ($(OS),Windows_NT)
    OS = win
else
    OS := $(shell uname -s)
    ifeq ($(UNAME_S),Linux)
        OS = linux
    endif
    ifeq ($(UNAME_S),Darwin)
        OS = mac
    endif
endif

APPNAME ?= lamprey-$(OS)-$(VERSION)
#OSX_TEAM_ID=
#OSX_BUNDLE_ID=LJKTDEZN58




all: $(OS)

mac: dmg

linux: deb

win:
	echo "working on it"

clean:
	touch node_modules
	rm -rf ~/.node-gyp ~/.electron-gyp ./node_modules lamprey-* include lib .Python pip-selfcheck.json bin build externals/nanonet

deps_mac:
	brew install zmq

deps_js:
	npm_config_target=$(npm_config_target) npm_config_arch=$(npm_config_arch) npm_config_target_arch=$(npm_config_target_arch) npm_config_disturl=$(npm_config_disturl) npm_config_runtime=$(npm_config_runtime) npm_config_build_from_source=$(npm_config_build_from_source) npm install

#py3:
#	cd externals/nanonet ; git checkout python3 ; make osx_zmqcall

deps_py:
	pip install --user zerorpc pyinstaller myriad h5py future pyzmq
#	pip install --user pyzmq --zmq=bundled
#	pip install --user pyzmq --no-binary :all:
	$(MAKE) deps_py_$(OS)

deps_py_linux:
	cd externals/nanonet ; python setup.py develop --user

deps_py_mac:
	cd externals/nanonet ; python setup.py develop --user

deps_py_win:
	cd externals/nanonet ; python setup.py develop mingw

py: deps_py
	touch dist
	rm -rf dist
	PATH=$(HOME)/.local/bin:$(HOME)/Library/Python/2.7/bin:$(PATH) pyinstaller --clean --log-level DEBUG api.spec

deps: clean
	git submodule update --init --recursive
	$(MAKE) deps_js deps_py

pack: deps
	$(MAKE) py
	touch lamprey-darwin-x64
	rm -rf lamprey-*
	./node_modules/.bin/electron-packager . --icon="assets/lamprey512x512" --overwrite --appBundleId="com.nanoporetech.lamprey"
	mv lamprey-* $(APPNAME)

#sign:
#	tools/mac/sign-app $(APPNAME)
#	codesign --deep --force --verbose --sign "com.nanoporetech.lamprey" $(APPNAME)
#	codesign --verify -vvvv $(APPNAME) and spctl -a -vvvv $(APPNAME)

deb: pack
	touch tmp
	rm -rf tmp
	mkdir -p tmp/opt/ONT/lamprey tmp/DEBIAN tmp/usr/share/applications tmp/usr/share/icons/hicolor/48x48/apps
	cp -pR $(APPNAME)/* tmp/opt/ONT/lamprey/
	cp tools/linux/debian-control tmp/DEBIAN/control
	cp tools/linux/lamprey.desktop tmp/usr/share/applications/
	cp assets/lamprey48x48.png tmp/usr/share/icons/hicolor/48x48/apps/lamprey.png
	sed -i "s/VERSION/$(VERSION)/g" tmp/DEBIAN/control
	perl -i -pe 's{INSTALLED_SIZE}{[split /\s+/smx, qx[du -sk tmp]]->[0]}e' tmp/DEBIAN/control
	chmod -R ugo+r tmp
	fakeroot dpkg -b tmp ont-lamprey-$(VERSION).deb

dmg: pack
	touch lamprey.dmg
	rm lamprey*dmg
	hdiutil create "lamprey-$(VERSION).dmg" -ov -volname "lamprey $(VERSION)" -format UDZO -imagekey zlib-level=9 -size 250M -fs HFS+ -srcfolder lamprey-Darwin-$(VERSION)
