from typing import List

from typing_extensions import Unpack

from e2b.api import handle_api_exception
from e2b.api.client.api.templates import get_v2_templates
from e2b.api.client.models.error import Error
from e2b.api.client.types import UNSET
from e2b.api.client_sync import get_api_client
from e2b.connection_config import ApiParams, ConnectionConfig
from e2b.exceptions import TemplateException
from e2b.paginator import PaginatorBase
from e2b.template.types import TemplateInfo


class TemplatePaginator(PaginatorBase[TemplateInfo, ApiParams]):
    """
    Paginator for listing templates.

    Example:
    ```python
    paginator = Template.list()

    while paginator.has_next:
        templates = paginator.next_items()
        print(templates)
    ```
    """

    def next_items(self, **opts: Unpack[ApiParams]) -> List[TemplateInfo]:
        """
        Returns the next page of templates.

        :param opts: Per-call connection options (e.g. `api_key`, `domain`,
            `headers`, `request_timeout`). When provided, this call uses these
            options instead of the ones the paginator was constructed with.

        :returns: List of templates
        """
        # An exhausted paginator returns an empty list rather than raising. The
        # sandbox and snapshot paginators currently raise here instead; they'll
        # be aligned to this behaviour.
        if not self.has_next:
            return []

        config = ConnectionConfig(**{**self._opts, **opts})
        api_client = get_api_client(config)
        res = get_v2_templates.sync_detailed(
            client=api_client,
            limit=self.limit if self.limit else UNSET,
            next_token=self._next_token if self._next_token else UNSET,
        )

        if res.status_code >= 300:
            raise handle_api_exception(res, TemplateException)

        self._update_pagination(res.headers)

        if res.parsed is None:
            return []

        if isinstance(res.parsed, Error):
            raise TemplateException(f"{res.parsed.message}: Request failed")

        return [TemplateInfo._from_template(template) for template in res.parsed]
