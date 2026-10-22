from enum import Enum


class GetTemplatesTemplateIDTagsGroupsSort(str, Enum):
    LATEST_ASC = "latest_asc"
    LATEST_DESC = "latest_desc"
    NAME_ASC = "name_asc"
    NAME_DESC = "name_desc"

    def __str__(self) -> str:
        return str(self.value)
