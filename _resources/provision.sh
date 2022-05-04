# Set up a login terminal on the serial console (ttyS0):
ln -s agetty /etc/init.d/agetty.ttyS0
echo ttyS0 > /etc/securetty

echo agetty_options="\"--autologin root --noclear\"" > /etc/conf.d/agetty.ttyS0

rc-update add agetty.ttyS0 default

# Make sure special file systems are mounted on boot:
rc-update add devfs boot
rc-update add procfs boot
rc-update add sysfs boot

passwd -d root

/bin/ash

# ERROR The ssh daemon is stuck on initializing!
/etc/init.d/sshd start
