#!/bin/bash

mkdir -p ~/Library/Baker/run

SCRIPTPATH="$( cd "$(dirname "$0")" ; pwd -P )"
pid=`cat ~/Library/Baker/run/bakerformac-vpnkit.pid`

if ! `launchctl list | grep "com.baker.u9fs." > /dev/null`; then
    echo "Starting u9fs"
    launchctl load $SCRIPTPATH/9pfs.plist
fi

SOCKETDIR=/Users/$USER/Library/Baker/sockets
mkdir -p $SOCKETDIR
#mkfifo /tmp/vsocket

ps -a | grep $pid | grep vpnkit.exe
vpnkitRunning=$?
if test $vpnkitRunning -ne 0; then
    echo "Starting vpnkit"
    $SCRIPTPATH/vendor/vpnkit.exe --host-names baker.for.mac.localhost --debug --ethernet $SOCKETDIR/bakerformac.sock --port $SOCKETDIR/bakerformac.port.socket --vsock-path $SOCKETDIR/connect  >~/Library/Baker/run/bakerformac-vpnkit.log 2>&1 &
    echo $! > ~/Library/Baker/run/bakerformac-vpnkit.pid
fi

DISKDIR=/Users/$USER/Library/Baker/disks
mkdir -p $DISKDIR
if [ ! -f $DISKDIR/bakerdisk.img ]; then
    dd if=/dev/zero of=$DISKDIR/bakerdisk.img bs=1 count=1 seek=34359738368
fi

# com.docker.vpnkit --ethernet fd:3 --port fd:4 --introspection fd:5 --diagnostics fd:6 --vsock-path /Users/andrew/Library/Containers/com.docker.docker/Data/connect --host-names docker.for.mac.localhost,docker.for.mac.host.internal --gateway-names docker.for.mac.gateway.internal,docker.for.mac.http.internal --listen-backlog 32 --mtu 1500 --allowed-bind-addresses 0.0.0.0 --http /Users/andrew/Library/Group Containers/group.com.docker/http_proxy.json --dhcp /Users/andrew/Library/Group Containers/group.com.docker/dhcp.json --port-max-idle-time 300 --max-connections 2000 --gateway-ip 192.168.65.1 --host-ip 192.168.65.2 --lowest-ip 192.168.65.3 --highest-ip 192.168.65.254 --log-destination asl


USEVPNKIT=true SCRIPTPATH=$SCRIPTPATH $SCRIPTPATH/hyperkitrun.sh
