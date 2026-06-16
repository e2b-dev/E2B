"""
Run a long command as a recoverable agent job.

This pattern lets a worker start a command, disconnect, then let another worker
reconnect by tag. It is useful for queues, callbacks, and agent supervisors that
cannot keep one HTTP connection open for the full job.
"""

from e2b import Sandbox

JOB_TAG = "agent-job-42"


def start_job(sandbox: Sandbox) -> int:
    handle = sandbox.commands.run(
        "python train_or_simulate.py",
        background=True,
        tag=JOB_TAG,
        timeout=0,
    )
    pid = handle.pid
    handle.disconnect()
    return pid


def collect_job(sandbox: Sandbox) -> None:
    handle = sandbox.commands.connect(tag=JOB_TAG, timeout=0)
    result = handle.wait()

    print("exit code", result.exit_code)
    print(result.stdout)


with Sandbox.create() as sandbox:
    start_job(sandbox)
    collect_job(sandbox)
