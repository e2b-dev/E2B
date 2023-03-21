import os
from typing import Any, Coroutine, Dict

from postgrest._async.client import AsyncPostgrestClient
from postgrest._async.request_builder import (
    AsyncFilterRequestBuilder,
    AsyncRequestBuilder,
)
from supabase.lib.client_options import ClientOptions
from supabase import Client as SyncClient


class Client(SyncClient):
    def __init__(
        self,
        supabase_url: str,
        supabase_key: str,
        options: ClientOptions = ClientOptions(),
    ):
        super().__init__(
            supabase_url=supabase_url,
            supabase_key=supabase_key,
            # options=options
        )
        self.postgrest: AsyncPostgrestClient = self._init_postgrest_client(
            rest_url=self.rest_url,
            supabase_key=self.supabase_key,
            headers=options.headers,
            schema=options.schema,
        )

    def table(self, table_name: str) -> AsyncRequestBuilder:
        return self.from_(table_name)

    def from_(self, table_name: str) -> AsyncRequestBuilder:
        return self.postgrest.from_(table_name)

    def rpc(
        self, fn: str, params: Dict[Any, Any]
    ) -> Coroutine[None, None, AsyncFilterRequestBuilder]:
        return self.postgrest.rpc(fn, params)

    @staticmethod
    def _init_postgrest_client(
        rest_url: str, supabase_key: str, headers: Dict[str, str], schema: str
    ) -> AsyncPostgrestClient:
        """Private helper for creating an instance of the Postgrest client."""
        client = AsyncPostgrestClient(rest_url, headers=headers, schema=schema)
        client.auth(token=supabase_key)
        return client


def create_client(
    supabase_url: str,
    supabase_key: str,
    options: ClientOptions = ClientOptions(),
) -> Client:
    return Client(supabase_url=supabase_url, supabase_key=supabase_key, options=options)


# instantiate like this
# url: str = os.getenv("SUPABASEURL")
# key: str = os.getenv("SUPABASEKEY")
# supabase: Client = create_client(url, key)
