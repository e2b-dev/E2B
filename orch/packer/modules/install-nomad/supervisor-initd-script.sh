#!/bin/bash
#
# supervisord   Startup script for the Supervisor process control system
#
# Author:       Mike McGrath <mmcgrath@redhat.com> (based off yumupdatesd)
#               Jason Koppe <jkoppe@indeed.com> adjusted to read sysconfig,
#                   use supervisord tools to start/stop, conditionally wait
#                   for child processes to shutdown, and startup later
#               Erwan Queffelec <erwan.queffelec@gmail.com>
#                   make script LSB-compliant
#
# chkconfig:    345 83 04
# description: Supervisor is a client/server system that allows \
#   its users to monitor and control a number of processes on \
#   UNIX-like operating systems.
# processname: supervisord
# config: /etc/supervisord.conf
# config: /etc/sysconfig/supervisord
# pidfile: /var/run/supervisord.pid
#
### BEGIN INIT INFO
# Provides: supervisord
# Required-Start: $all
# Required-Stop: $all
# Short-Description: start and stop Supervisor process control system
# Description: Supervisor is a client/server system that allows
#   its users to monitor and control a number of processes on
#   UNIX-like operating systems.
### END INIT INFO

# Source function library
. /etc/rc.d/init.d/functions

# Source system settings
if [ -f /etc/sysconfig/supervisord ]; then
    . /etc/sysconfig/supervisord
fi

# Path to the supervisorctl script, server binary,
# and short-form for messages.
supervisorctl=/usr/local/bin/supervisorctl
supervisord=${SUPERVISORD-/usr/local/bin/supervisord}
prog=supervisord
pidfile=${PIDFILE-/tmp/supervisord.pid}
lockfile=${LOCKFILE-/var/lock/subsys/supervisord}
STOP_TIMEOUT=${STOP_TIMEOUT-60}
OPTIONS="${OPTIONS--c /etc/supervisor/supervisord.conf}"
RETVAL=0

start() {
    echo -n $"Starting $prog: "
    daemon --pidfile=${pidfile} $supervisord $OPTIONS
    RETVAL=$?
    echo
    if [ $RETVAL -eq 0 ]; then
        touch ${lockfile}
        $supervisorctl $OPTIONS status
    fi
    return $RETVAL
}

stop() {
    echo -n $"Stopping $prog: "
    killproc -p ${pidfile} -d ${STOP_TIMEOUT} $supervisord
    RETVAL=$?
    echo
    [ $RETVAL -eq 0 ] && rm -rf ${lockfile} ${pidfile}
}

reload() {
    echo -n $"Reloading $prog: "
    LSB=1 killproc -p $pidfile $supervisord -HUP
    RETVAL=$?
    echo
    if [ $RETVAL -eq 7 ]; then
        failure $"$prog reload"
    else
        $supervisorctl $OPTIONS status
    fi
}

restart() {
    stop
    start
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    status)
        status -p ${pidfile} $supervisord
        RETVAL=$?
        [ $RETVAL -eq 0 ] && $supervisorctl $OPTIONS status
        ;;
    restart)
        restart
        ;;
    condrestart|try-restart)
        if status -p ${pidfile} $supervisord >&/dev/null; then
          stop
          start
        fi
        ;;
    force-reload|reload)
        reload
        ;;
    *)
        echo $"Usage: $prog {start|stop|restart|condrestart|try-restart|force-reload|reload}"
        RETVAL=2
    esac

    exit $RETVAL