from datetime import datetime, timezone
from http import HTTPStatus

import pytest

from e2b import Template, TemplateBuildStatus, TemplateInfo
from e2b.api.client.models import Error, Template as TemplateModel
from e2b.api.client.types import UNSET, Response
from e2b.exceptions import TemplateException
import e2b.api.client.api.templates.get_v2_templates as get_v2_templates_mod


def _template(index: int) -> TemplateModel:
    data = {
        "templateID": f"template-{index}",
        "buildID": f"00000000-0000-0000-0000-00000000000{index}",
        "names": [f"team/template-{index}"],
        "aliases": [f"template-{index}"],
        "public": index == 0,
        "isDefault": index == 0,
        "buildStatus": "ready",
        "cpuCount": 2,
        "memoryMB": 1024,
        "diskSizeMB": 5120,
        "envdVersion": "0.2.0",
        "buildCount": index + 1,
        "spawnCount": index * 10,
        "createdBy": None,
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-16T12:00:00Z",
        "lastSpawnedAt": None if index == 0 else "2024-01-17T08:00:00Z",
    }
    if index == 1:
        data["description"] = "Second template"
        data["maxCpuCount"] = 4
    return TemplateModel.from_dict(data)


_templates = [_template(i) for i in range(3)]


@pytest.fixture(autouse=True)
def mock_list_api(monkeypatch, test_api_key):
    monkeypatch.setenv("E2B_API_KEY", test_api_key)

    def mock_get_v2_templates(*, client, team_id=UNSET, next_token=UNSET, limit=UNSET):
        page_size = limit if isinstance(limit, int) else 100
        start = int(next_token) if isinstance(next_token, str) else 0
        headers = {}
        if start + page_size < len(_templates):
            headers["x-next-token"] = str(start + page_size)
        return Response(
            status_code=HTTPStatus(200),
            content=b"",
            headers=headers,
            parsed=_templates[start : start + page_size],
        )

    monkeypatch.setattr(get_v2_templates_mod, "sync_detailed", mock_get_v2_templates)


def test_list_templates_with_pagination():
    paginator = Template.list(limit=2)

    first_page = paginator.next_items()
    assert [t.template_id for t in first_page] == ["template-0", "template-1"]
    assert paginator.has_next is True
    assert paginator.next_token == "2"

    second_page = paginator.next_items()
    assert [t.template_id for t in second_page] == ["template-2"]
    assert paginator.has_next is False

    with pytest.raises(Exception, match="No more items"):
        paginator.next_items()


def test_list_templates_from_next_token():
    paginator = Template.list(next_token="1")

    items = paginator.next_items()
    assert [t.template_id for t in items] == ["template-1", "template-2"]
    assert paginator.has_next is False


def test_list_templates_maps_template_info():
    default_template, described, _ = Template.list().next_items()

    assert default_template == TemplateInfo(
        template_id="template-0",
        build_id="00000000-0000-0000-0000-000000000000",
        names=["team/template-0"],
        public=True,
        is_default=True,
        build_status=TemplateBuildStatus.READY,
        cpu_count=2,
        memory_mb=1024,
        disk_size_mb=5120,
        envd_version="0.2.0",
        build_count=1,
        spawn_count=0,
        created_at=datetime(2024, 1, 15, 10, 30, tzinfo=timezone.utc),
        updated_at=datetime(2024, 1, 16, 12, 0, tzinfo=timezone.utc),
    )
    assert described.description == "Second template"
    assert described.max_cpu_count == 4
    assert described.last_spawned_at == datetime(2024, 1, 17, 8, 0, tzinfo=timezone.utc)


def test_list_templates_raises_template_exception(monkeypatch):
    def mock_error(*, client, team_id=UNSET, next_token=UNSET, limit=UNSET):
        return Response(
            status_code=HTTPStatus(500),
            content=b'{"code": 500, "message": "internal error"}',
            headers={},
            parsed=Error(code=500, message="internal error"),
        )

    monkeypatch.setattr(get_v2_templates_mod, "sync_detailed", mock_error)

    with pytest.raises(TemplateException):
        Template.list().next_items()
