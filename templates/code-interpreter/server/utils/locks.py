import asyncio


class LockedMap(dict):
    def __init__(self):
        super().__init__()
        self._map_lock = asyncio.Lock()
        self._locks = {}

    async def get_lock(self, key):
        await self._map_lock.acquire()
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()

        lock = self._locks[key]
        print(f"Lock acquired for {key}")
        self._map_lock.release()
        return lock
