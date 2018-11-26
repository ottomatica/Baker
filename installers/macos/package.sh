#!/bin/bash

# Check if this is running on a Mac
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "You can only package (.pkg) installer on a Mac OS!"
    exit 1
fi

# Name of the package.
NAME="baker"
PACKAGEREL="installers/macos"

# Once installed the identifier is used as the filename for a receipt files in /var/db/receipts/.
IDENTIFIER="io.ottomatica.$NAME"

# Package version number.
VERSION="0.6.15"

# The location to copy the contents of files.
INSTALL_LOCATION="/opt/baker/bin"

# Remove any unwanted .DS_Store files.
find $PACKAGEREL/bin/ -name '*.DS_Store' -type f -delete

# Set full read, write, execute permissions for owner and just read and execute permissions for group and other.
/bin/chmod -R 755 $PACKAGEREL/bin/baker
/bin/chmod -R 755 $PACKAGEREL/scripts


# Make bin dir if doesn't exist
if [ ! -d "$PACKAGEREL/bin" ]; then
    mkdir "$PACKAGEREL/bin"
fi

# Build package.
/usr/bin/pkgbuild \
    --root $PACKAGEREL/bin/ \
    --install-location "$INSTALL_LOCATION" \
    --scripts $PACKAGEREL/scripts/ \
    --identifier "$IDENTIFIER" \
    --version "$VERSION" \
    "$PACKAGEREL/bin/$NAME-$VERSION.pkg"
