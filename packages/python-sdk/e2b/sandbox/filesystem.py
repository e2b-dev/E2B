import logging
import connect

from typing import List

from envd.filesystem.v1 import filesystem_connect, filesystem_pb2

logger = logging.getLogger(__name__)


# TODO: Provide a way to cancel requests (watch)
class Filesystem:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url

        self._service = filesystem_connect.FilesystemServiceClient(
            self.base_url,
            compressor=connect.GzipCompressor,
        )

    def list(self, path: str) -> List[filesystem_pb2.EntryInfo]:
        params = filesystem_pb2.ListRequest(path=path)

        res = self._service.list(params)
        return [entry for entry in res.entries]

    def stat(self, path: str) -> filesystem_pb2.EntryInfo:
        params = filesystem_pb2.StatRequest(path=path)

        res = self._service.stat(params)
        return res.entry

    def remove(self, path: str) -> None:
        params = filesystem_pb2.RemoveRequest(path=path)

        self._service.remove(params)

    def watch(
        self,
        path: str,
    ):
        params = filesystem_pb2.WatchRequest(path=path)

        events = self._service.watch(params)

        def stream():
            for event in events:
                yield event.event

        return stream()
