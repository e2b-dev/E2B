# Devbook Daemon

Devbook daemon can run in 2 modes
1. user mode
2. server mode

The server mode is meant to run on Devbook infrastructure for our Devbook VMs. The user mode is intended for users to use together with our Devbook browser extension for terminal.

## Usage

### `server` mode
The server mode is meant to run on Devbook infrastructure for our Devbook VMs.

By default, devbookd starts in the server mode.
```sh
devbookd
```

Optionally, pass the `mode` flag.
```sh
devbookd -mode=server
```

### `user` mode (only macOS supported)
The user mode is intended for users to use together with our Devbook browser extension for terminal.

```sh
devbookd -mode=user
```

### `debug` flag
Running in debug mode will print all stdout and stderr to the console.
```sh
devbookd -debug
```

### `version` flag
Running devbookd with the `-version` flag will print the devbookd version to the console.
```sh
devbookd -version
```

## User installation (only macOS supported)
> ❌ Don't use this for installing devbookd on your server!

```sh
curl -L https://install.usedevbook.com/devbookd | sh
```
