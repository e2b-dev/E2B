from typing import Any, Dict, List, Optional, Union, Unpack

from e2b.api import encode_path_param, handle_api_exception
from e2b.api.client.models import Error
from e2b.api.client.models import TemplateBuildStatus as TemplateBuildStatusModel
from e2b.api.client.models import TemplateBuildWithTags as TemplateBuildWithTagsModel
from e2b.api.client.types import UNSET, Response
from e2b.connection_config import ApiParams
from e2b.exceptions import (
    InvalidArgumentException,
    TemplateException,
    TemplateNotFoundException,
)
from e2b.paginator import PaginatorBase
from e2b.template.types import TemplateBuildStatus, TemplateBuildWithTags
from e2b.template.utils import is_template_not_found, validate_name_or_id_without_tag


class TemplateBuildPaginatorBase(PaginatorBase[TemplateBuildWithTags, ApiParams]):
    """
    What the sync and async build paginators share: the checked filters, the
    arguments of a page request, and the reading of its response.
    """

    def __init__(
        self,
        name_or_id: str,
        *,
        statuses: Optional[List[TemplateBuildStatus]] = None,
        tags: Optional[List[str]] = None,
        limit: Optional[int] = None,
        next_token: Optional[str] = None,
        **opts: Unpack[ApiParams],
    ):
        super().__init__(limit=limit, next_token=next_token, **opts)

        validate_name_or_id_without_tag(name_or_id)
        self._name_or_id = name_or_id

        # Each filter is a list. A string is refused rather than read as a list
        # of its characters, and any other iterable is refused with it.
        for name, value in (("statuses", statuses), ("tags", tags)):
            if value is not None and not isinstance(value, list):
                raise InvalidArgumentException(f"'{name}' must be a list.")

        # Each filter is copied so that it is the same for every page.
        self._statuses: List[TemplateBuildStatusModel] = []
        for status in statuses or []:
            try:
                self._statuses.append(TemplateBuildStatusModel(status))
            except ValueError:
                expected = ", ".join(status.value for status in TemplateBuildStatus)
                raise InvalidArgumentException(
                    f"Unknown build status '{status}', expected one of: {expected}."
                )
        # A status given twice is sent once: the API refuses repeated statuses.
        self._statuses = list(dict.fromkeys(self._statuses))

        # Tags are sent as one comma-separated value, so an empty tag or one
        # with a comma would not reach the API as the tag that was given.
        self._tags = list(tags or [])
        for tag in self._tags:
            if tag.strip(" \t\n\r\f\v") == "" or "," in tag:
                raise InvalidArgumentException(
                    f"Invalid tag '{tag}': a tag must not be empty or contain a comma."
                )

    def _page_request(self) -> Dict[str, Any]:
        """Arguments of the request for the next page."""
        if not self.has_next:
            raise Exception("No more items to fetch")

        return {
            "template_id": encode_path_param(self._name_or_id),
            "limit": self.limit if self.limit else UNSET,
            "next_token": self._next_token if self._next_token else UNSET,
            # An empty filter is no filter, so it is left out. The client
            # would otherwise send `statuses=` and `tags=` with empty values.
            "statuses": self._statuses if self._statuses else UNSET,
            "tags": self._tags if self._tags else UNSET,
        }

    def _page(
        self, res: Response[Union[Error, List[TemplateBuildWithTagsModel]]]
    ) -> List[TemplateBuildWithTags]:
        """The builds of a page response; moves the paginator to the next page."""
        if is_template_not_found(res.parsed):
            raise TemplateNotFoundException(f"Template '{self._name_or_id}' not found")

        if res.status_code >= 300:
            raise handle_api_exception(res, TemplateException)

        self._update_pagination(res.headers)

        if res.parsed is None:
            return []

        if isinstance(res.parsed, Error):
            raise TemplateException(f"{res.parsed.message}: Request failed")

        return [
            TemplateBuildWithTags._from_model_with_tags(build) for build in res.parsed
        ]
