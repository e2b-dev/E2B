import asyncio

class DeferredFuture:
    def __init__(self):
        self.future = asyncio.Future()

    def resolve(self, value):
        self.future.set_result(value)

    def reject(self, reason):
        self.future.set_exception(reason)

    @property
    def promise(self):
        return self.future
