import asyncio

class Event(asyncio.Event):
    # TODO: clear() method
    def set(self):
        # FIXME: The _loop attribute is not documented as public api!
        self._loop.call_soon_threadsafe(super().set)
