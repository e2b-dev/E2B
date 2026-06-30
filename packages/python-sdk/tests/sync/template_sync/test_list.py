import uuid

import pytest

from e2b import Sandbox, Template


@pytest.mark.skip_debug()
def test_list_templates(build):
    name = f"e2b-list-test:v1-{uuid.uuid4()}"
    build_info = build(Template().from_base_image(), name=name)

    assert build_info.template_id

    try:
        # Paginate through the real /v2/templates endpoint.
        paginator = Template.list()
        templates = []
        while paginator.has_next:
            templates.extend(paginator.next_items())

        found = next(
            (t for t in templates if t.template_id == build_info.template_id),
            None,
        )
        assert found is not None
        assert isinstance(found.build_id, str)
        assert isinstance(found.names, list)
        assert isinstance(found.public, bool)
        assert isinstance(found.cpu_count, int)

        # An exhausted paginator returns an empty list rather than raising.
        assert paginator.has_next is False
        assert paginator.next_items() == []
    finally:
        Sandbox.delete_snapshot(build_info.template_id)
