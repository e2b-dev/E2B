from typing import List, Unpack

from e2b.api import handle_api_exception
from e2b.api.client.api.templates import (
    get_templates_template_id_builds,
    get_v2_templates,
)
from e2b.api.client.models import Error
from e2b.api.client.types import UNSET
from e2b.api.client_sync import get_api_client
from e2b.connection_config import ApiParams, ConnectionConfig, merge_api_params
from e2b.exceptions import TemplateException
from e2b.paginator import PaginatorBase
from e2b.template.paginator import TemplateBuildPaginatorBase
from e2b.template.types import TemplateBuildWithTags, TemplateInfo


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

        Call this method only if `has_next` is `True`, otherwise it will raise an exception.

        :param opts: Per-call connection options (e.g. `api_key`, `domain`,
            `headers`, `request_timeout`). When provided, this call uses these
            options instead of the ones the paginator was constructed with.

        :return: List of templates.
        """
        if not self.has_next:
            raise Exception("No more items to fetch")

        config = ConnectionConfig(**merge_api_params(self._opts, opts))
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

        return [TemplateInfo._from_model(template) for template in res.parsed]


class TemplateBuildPaginator(TemplateBuildPaginatorBase):
    """
    Paginator for listing the builds of a template, newest first.

    Example:
    ```python
    paginator = Template.list_builds('my-template')

    while paginator.has_next:
        builds = paginator.next_items()
        print(builds)
    ```
    """

    def next_items(self, **opts: Unpack[ApiParams]) -> List[TemplateBuildWithTags]:
        """
        Returns the next page of builds, each with the tags that point at it.

        Call this method only if `has_next` is `True`, otherwise it will raise an exception.

        :param opts: Per-call connection options, used instead of the ones the
            paginator was constructed with.
        :raises TemplateNotFoundException: If the template is not found
        """
        page_request = self._page_request()
        config = ConnectionConfig(**merge_api_params(self._opts, opts))
        res = get_templates_template_id_builds.sync_detailed(
            client=get_api_client(config), **page_request
        )

        return self._page(res)
