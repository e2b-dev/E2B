import asyncio


class DeferredFuture:
    def __init__(self):
        self.future = asyncio.Future()

    def resolve(self):
        if self.future.done():
            return
        self.future.set_result(None)

    def reject(self, reason):
        if self.future.done():
            return
        self.future.set_exception(reason)

    def __await__(self):
        yield from self.future.__await__()
