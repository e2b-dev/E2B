import pytest

from e2b import AsyncSandbox, CommandExitException, TimeoutException


@pytest.mark.asyncio
async def test_skip_shell_startup_preserves_command_environment(
    async_sandbox: AsyncSandbox,
):
    await async_sandbox.files.write(
        "/tmp/e2b-bash-env", "export STARTUP_MARKER=loaded\n"
    )
    envs = {"BASH_ENV": "/tmp/e2b-bash-env", "COMMAND_MARKER": "preserved"}
    result = await async_sandbox.commands.run(
        'printf "%s:%s" "${STARTUP_MARKER-unset}" "$COMMAND_MARKER"',
        shell_startup="skip",
        envs=envs,
    )
    assert result.stdout == "unset:preserved"
    assert envs["BASH_ENV"] == "/tmp/e2b-bash-env"


@pytest.mark.parametrize("user", ["root", "user"])
async def test_shell_startup_profiles(async_sandbox: AsyncSandbox, user):
    sandbox = async_sandbox
    home = "/root" if user == "root" else "/home/user"
    await sandbox.files.write(
        "/etc/profile.d/e2b-startup-test.sh",
        "export SYSTEM_MARKER=loaded\n",
        user="root",
    )
    await sandbox.files.write(f"{home}/.bashrc", "export RC_MARKER=loaded\n", user=user)
    await sandbox.files.write(
        f"{home}/.profile",
        '. "$HOME/.bashrc"; export PROFILE_MARKER=loaded\n',
        user=user,
    )
    await sandbox.files.write(
        f"{home}/.bash_profile",
        '. "$HOME/.profile"; export LOGIN_MARKER=loaded\n',
        user=user,
    )
    cmd = 'printf "%s:%s:%s:%s" "${SYSTEM_MARKER-unset}" "${LOGIN_MARKER-unset}" "${PROFILE_MARKER-unset}" "${RC_MARKER-unset}"'
    for options in [{}, {"shell_startup": "default"}, {"shell_startup": "skip"}]:
        result = await sandbox.commands.run(cmd, user=user, **options)
        expected = (
            "unset:unset:unset:unset"
            if options.get("shell_startup") == "skip"
            else "loaded:loaded:loaded:loaded"
        )
        assert result.stdout == expected


async def test_skip_inherited_bash_env(async_sandbox_factory):
    sandbox = await async_sandbox_factory(envs={"BASH_ENV": "/tmp/e2b-global-bash-env"})
    await sandbox.files.write(
        "/tmp/e2b-global-bash-env", "export STARTUP_MARKER=loaded\n"
    )
    cmd = """printf '%s:' "${STARTUP_MARKER-unset}"; bash -c 'printf %s "${STARTUP_MARKER-unset}"'"""
    assert (await sandbox.commands.run(cmd)).stdout == "loaded:loaded"
    assert (
        await sandbox.commands.run(cmd, shell_startup="skip")
    ).stdout == "unset:unset"


async def test_skip_preserves_command_lifecycle(async_sandbox: AsyncSandbox):
    sandbox = async_sandbox
    stdout = []
    stderr = []
    handle = await sandbox.commands.run(
        'read -r line; printf "%s:%s" "$PWD" "$line" | cat; printf err >&2; exit 7',
        shell_startup="skip",
        cwd="/tmp",
        stdin=True,
        background=True,
        on_stdout=stdout.append,
        on_stderr=stderr.append,
    )
    await handle.send_stdin('hello "world"\n')
    with pytest.raises(CommandExitException) as exc:
        await handle.wait()
    assert exc.value.exit_code == 7
    assert exc.value.stdout == '/tmp:hello "world"'
    assert exc.value.stderr == "err"
    assert "".join(stdout) == '/tmp:hello "world"'
    assert "".join(stderr) == "err"
    with pytest.raises(TimeoutException):
        await sandbox.commands.run("sleep 10", shell_startup="skip", timeout=0.1)
