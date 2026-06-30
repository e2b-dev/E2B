import uuid

import pytest

from e2b import AsyncSandbox, AsyncTemplate


@pytest.mark.skip_debug()
async def test_list_templates(async_build):
    name = f"e2b-list-test:v1-{uuid.uuid4()}"
    build_info = await async_build(AsyncTemplate().from_base_image(), name=name)

    assert build_info.template_id

    try:
        # Paginate through the real /v2/templates endpoint.
        paginator = AsyncTemplate.list()
        templates = []
        while paginator.has_next:
            templates.extend(await paginator.next_items())

        found = next(
            (t for t in templates if t.template_id == build_info.template_id),
            None,
        )
        assert found is not None
        assert found.build_id == build_info.build_id
        assert isinstance(found.names, list)
        assert isinstance(found.public, bool)
        assert isinstance(found.cpu_count, int)

        # An exhausted paginator returns an empty list rather than raising.
        assert paginator.has_next is False
        assert await paginator.next_items() == []
    finally:
        await AsyncSandbox.delete_snapshot(build_info.template_id)
