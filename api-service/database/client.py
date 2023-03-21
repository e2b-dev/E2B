import os
from typing import Any, Coroutine, Dict

from postgrest._async.client import AsyncPostgrestClient
from postgrest._async.request_builder import (
    AsyncFilterRequestBuilder,
    AsyncRequestBuilder,
)
from supabase.lib.client_options import ClientOptions
from supabase.client import Client as SyncClient


# class Client(SyncClient):
#     def __init__(
#         self,
#         supabase_url: str,
#         supabase_key: str,
#         options: ClientOptions = ClientOptions(),
#     ):
#         super().__init__(
#             supabase_url=supabase_url, supabase_key=supabase_key, options=options
#         )
#         self.postgrest: AsyncPostgrestClient = self._init_postgrest_client(
#             rest_url=self.rest_url,
#             supabase_key=self.supabase_key,
#             headers=options.headers,
#             schema=options.schema,
#         )

#     def table(self, table_name: str) -> AsyncRequestBuilder:
#         return self.from_(table_name)

#     def from_(self, table_name: str) -> AsyncRequestBuilder:
#         return self.postgrest.from_(table_name)

#     def rpc(
#         self, fn: str, params: Dict[Any, Any]
#     ) -> Coroutine[None, None, AsyncFilterRequestBuilder]:
#         return self.postgrest.rpc(fn, params)

#     @staticmethod
#     def _init_postgrest_client(
#         rest_url: str, supabase_key: str, headers: Dict[str, str], schema: str
#     ) -> AsyncPostgrestClient:
#         """Private helper for creating an instance of the Postgrest client."""
#         client.auth(token=supabase_key)
#         return client


def create_client(
    supabase_url: str,
    supabase_key: str,
    options: ClientOptions = ClientOptions(),
):

    client = SyncClient(
        supabase_url=supabase_url, supabase_key=supabase_key, options=options
    )

    client.postgrest = AsyncPostgrestClient(
        client.rest_url, headers=options.headers, schema=options.schema
    )

    def from_(table_name: str) -> AsyncRequestBuilder:
        return client.postgrest.from_(table_name)

    def table(table_name: str) -> AsyncRequestBuilder:
        return from_(table_name)

    def rpc(
        self, fn: str, params: Dict[Any, Any]
    ) -> Coroutine[None, None, AsyncFilterRequestBuilder]:
        return client.postgrest.rpc(fn, params)

    client.table = table
    client.rpc = rpc

    return client


# instantiate like this
# url: str = os.getenv("SUPABASEURL")
# key: str = os.getenv("SUPABASEKEY")
# supabase: Client = create_client(url, key)
