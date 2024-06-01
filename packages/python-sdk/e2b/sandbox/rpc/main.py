from e2b.sandbox.rpc.filesystem import Filesystem
from e2b.sandbox.rpc.process import Process


class SandboxRpc:
    def __init__(self, url: str):

        self.filesystem = Filesystem()
        self.process = Process()
