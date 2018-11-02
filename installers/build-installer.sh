#!/bin/bash

if [ -z ${1+x} ]; then
    echo "Usage: ./build-installer.sh <release>"
    exit 1
else
    echo "Creating installers for '$1'"
fi

BAKER_RELEASE=$1

echo "Updating package.json in ../package.json to be $BAKER_RELEASE"
sed -i "" -e "s/  \"version\": .*/  \"version\": \"${BAKER_RELEASE}\",/" "../package.json"

echo "Updating VERSION in macos/package.sh to be $BAKER_RELEASE";
sed -i "" -e "s/VERSION=.*/VERSION=\"${BAKER_RELEASE}\"/" "macos/package.sh"

echo "Updating Version in linux/deb-template/baker/DEBIAN/control to be $BAKER_RELEASE";
sed -i "" -e "s/Version: .*/Version: ${BAKER_RELEASE}/" "linux/deb-template/baker/DEBIAN/control"

echo "Updating AppVersion in win/scripts/baker.iss to be $BAKER_RELEASE";
sed -i "" -e "s/AppVersion=.*/AppVersion=${BAKER_RELEASE}/" "win/scripts/baker.iss"

# clean any old files
rm -f macos/bin/*

cd ../
echo "running mac installer"
npm run package-macos
echo "running linux installer"
npm run package-linux

cd installers
echo "creating tar.gz for homebrew"
mkdir -p /tmp/baker-release/${BAKER_RELEASE}/
cwd=$(pwd)
echo "$cwd"
# clean any old files
rm -f /tmp/baker-release/${BAKER_RELEASE}/*
cp macos/bin/baker /tmp/baker-release/${BAKER_RELEASE}/
cd /tmp/baker-release/ && tar -zcvf $cwd/macos/bin/baker-macos-latest.tar.gz ${BAKER_RELEASE}/
cd $cwd

echo "moving new pkg to baker-latest.pkg for mac"
mv macos/bin/baker-${BAKER_RELEASE}.pkg macos/bin/baker-latest.pkg

SHA=$(shasum -a 256 macos/bin/baker-macos-latest.tar.gz | awk '{printf $1}')
echo "Update homebrew shaw: $SHA";
echo "Version: ${BAKER_RELEASE}"

echo "You are not done, yet"
echo "You need to upload the .tar.gz, .pkg, and .deb on github."
echo "Then you need to switch to a windows machine and run 'grunt'"
echo "Then you need to rename win/bin/baker-setup.exe to baker-windows-latest.exe and upload too"
echo "Finally, you need to update the sha to $SHA and VERSION to ${BAKER_RELEASE} in ottomatica/homebrew"
