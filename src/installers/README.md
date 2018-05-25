# Current steps to create a release:

    ensure the semver in package.json:3, ./src/installers/linux/deb-template/baker/DEBIAN/control:2, ./src/installers/macos/package.sh:17, and ./src/installers/win/scripts/baker.iss:10,11 are correct/updated

    from ./src directory run:

    npm run package-macos # Run on Mac -- running `grunt` will do this on Mac automatically
    npm run package-linux # Run on Mac or Linux, you need dpkg: `brew install dpkg`
    grunt # On windows, it creates the setup file

    note: if you have a ./src/lib/.DS_Store file, this will fail and you have to remove it ...

    The executable for mac and .deb for linux are in these paths:
        ./src/installers/macos/bin/baker
        ./src/installers/linux/deb/baker.deb

    create a release here: https://github.com/ottomatica/baker-release/releases

    upload the files to that release with these changes:
        rename .deb file to baker-linux-<version>.deb and upload
        create a .tar.gz file of Mac executable by running

        tar -zcvf baker-macos-<version>.tar.gz baker

        upload baker-macos-<version>.tar.gz
        rename Windows setup file to baker-windows-<version>.exe and upload

    last step is to update the homebrew formula to use this new version.
        find the sha256 for .tar.gz file by running

         shasum -a 256 baker-macos-<version>.tar.gz | awk '{printf $1}' | pbcopy

        update the url and sha256 in homebrew-ottomatica repo.
