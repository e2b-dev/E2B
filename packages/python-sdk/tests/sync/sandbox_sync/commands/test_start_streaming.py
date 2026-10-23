from e2b import Sandbox


def test_streaming_command_yields_output_without_retaining_it(sandbox: Sandbox):
    cmd = sandbox.commands._start(
        "echo out; echo err >&2",
        envs=None,
        user=None,
        cwd=None,
        stdin=False,
        timeout=60,
        request_timeout=None,
        retain_output=False,
    )

    stdout, stderr = "", ""
    for out, err, _ in cmd:
        stdout += out or ""
        stderr += err or ""

    result = cmd.wait()

    assert stdout == "out\n"
    assert stderr == "err\n"
    assert result.stdout == ""
    assert result.stderr == ""
    assert result.exit_code == 0
