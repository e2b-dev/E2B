from typing import Dict

from pydantic import BaseModel, PrivateAttr

from postgrest._async.client import AsyncPostgrestClient
from postgrest._async.request_builder import (
    AsyncRequestBuilder,
)

class Client(BaseModel):
    _supabase_url: str = PrivateAttr()
    _supabase_key: str = PrivateAttr()
    _rest_url: str = PrivateAttr()

    _client: AsyncPostgrestClient = PrivateAttr()

    def __init__(self, supabase_url: str, supabase_key: str) -> None:
        self._supabase_url = supabase_url
        self._supabase_key = supabase_key

        self._rest_url = f"{supabase_url}/rest/v1"

        # Initialize AsyncPostgrestClient
        self._client = AsyncPostgrestClient(
            base_url=self._rest_url,
            headers=self._get_auth_headers(),
        )
        self._client.auth(token=self._supabase_key)

    def table(self, name: str) -> AsyncRequestBuilder:
        return self._client.table(name)

    def _get_auth_headers(self) -> Dict[str, str]:
        return {
            "apiKey": self._supabase_key,
            "Authorization": f"Bearer {self._supabase_key}",
        }
