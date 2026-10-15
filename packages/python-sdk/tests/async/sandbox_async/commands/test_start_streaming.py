from e2b import AsyncSandbox


async def test_streaming_command_delivers_output_only_to_callbacks(
    async_sandbox: AsyncSandbox,
):
    stdout, stderr = [], []
    cmd = await async_sandbox.commands._start(
        "echo out; echo err >&2",
        envs=None,
        user=None,
        cwd=None,
        stdin=False,
        timeout=60,
        request_timeout=None,
        on_stdout=stdout.append,
        on_stderr=stderr.append,
        retain_output=False,
    )

    result = await cmd.wait()

    assert "".join(stdout) == "out\n"
    assert "".join(stderr) == "err\n"
    assert cmd.stdout == ""
    assert result.stdout == ""
    assert result.stderr == ""
    assert result.exit_code == 0
