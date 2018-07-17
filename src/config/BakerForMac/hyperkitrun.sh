#!/bin/sh

HYPERKIT="hyperkit"

# Linux
INITRD=$SCRIPTPATH/file.img.gz
#KERNEL="kernel/vmlinuz-virt"
#KERNEL="kernel/vmlinuz-vanilla"
KERNEL=$SCRIPTPATH/kernel

CMDLINE="modules=virtio_net console=tty0 console=ttyS0 console=ttyAMA0"

MEM="-m 1G"
#SMP="-c 2"
NET="-s 1:0,virtio-net"
if $USEVPNKIT; then
    echo "using vpnkit for network"
    NET="-s 1:0,virtio-vpnkit,path=/tmp/bakerformac.sock"
fi

#IMG_CD="-s 3,ahci-cd,/somepath/somefile.iso"
#IMG_HDD="-s 4,virtio-blk,/somepath/somefile.img"
PORT="-s 5,virtio-9p,path=/tmp/bakerformac.port.socket,tag=port"
PCI_DEV="-s 0:0,hostbridge -s 31,lpc"
LPC_DEV="-l com1,stdio"
ACPI="-A"
#UUID="-U deadbeef-dead-dead-dead-deaddeafbeef"

FORWARD="-s 7,virtio-sock,guest_cid=3,path=/tmp/,guest_forwards=2000"
RND="-s 2,virtio-rnd"

$SCRIPTPATH/vendor/hyperkit $ACPI $MEM $SMP $PCI_DEV $LPC_DEV $NET $PORT $FORWARD $IMG_CD $IMG_HDD $UUID -f kexec,$KERNEL,$INITRD,"$CMDLINE"
