import uuid
from datetime import datetime, timezone

import pytest

from e2b import AsyncTemplate, Template
from e2b.exceptions import TemplateException

BUILD_ID = "00000000-0000-0000-0000-000000000000"


@pytest.fixture
def api_opts(fake_api, test_api_key):
    return {"api_key": test_api_key, "api_url": fake_api.url}


class TestAssignTags:
    """Tests for AsyncTemplate.assign_tags method."""

    async def test_assign_single_tag(self, fake_api, api_opts):
        """A single tag is sent as a one-element list and the response is parsed."""
        fake_api.route(
            "POST",
            "/templates/tags",
            201,
            {"buildID": BUILD_ID, "tags": ["production"]},
        )

        result = await AsyncTemplate.assign_tags(
            "my-template:v1.0", "production", **api_opts
        )

        assert fake_api.requests_to("POST", "/templates/tags") == [
            {"target": "my-template:v1.0", "tags": ["production"]}
        ]
        assert result.build_id == BUILD_ID
        assert result.tags == ["production"]

    async def test_assign_multiple_tags(self, fake_api, api_opts):
        """Multiple tags are sent as given and the response is parsed."""
        fake_api.route(
            "POST",
            "/templates/tags",
            201,
            {"buildID": BUILD_ID, "tags": ["production", "stable"]},
        )

        result = await AsyncTemplate.assign_tags(
            "my-template:v1.0", ["production", "stable"], **api_opts
        )

        assert fake_api.requests_to("POST", "/templates/tags") == [
            {"target": "my-template:v1.0", "tags": ["production", "stable"]}
        ]
        assert result.build_id == BUILD_ID
        assert result.tags == ["production", "stable"]


class TestRemoveTags:
    """Tests for AsyncTemplate.remove_tags method."""

    async def test_remove_single_tag(self, fake_api, api_opts):
        """A single tag is sent as a one-element list."""
        fake_api.route("DELETE", "/templates/tags", 204)

        assert (
            await AsyncTemplate.remove_tags("my-template", "production", **api_opts)
            is None
        )

        assert fake_api.requests_to("DELETE", "/templates/tags") == [
            {"name": "my-template", "tags": ["production"]}
        ]

    async def test_remove_multiple_tags(self, fake_api, api_opts):
        """Multiple tags are sent as given."""
        fake_api.route("DELETE", "/templates/tags", 204)

        await AsyncTemplate.remove_tags(
            "my-template", ["production", "staging"], **api_opts
        )

        assert fake_api.requests_to("DELETE", "/templates/tags") == [
            {"name": "my-template", "tags": ["production", "staging"]}
        ]

    async def test_remove_tags_error(self, fake_api, api_opts):
        """A 404 from the API surfaces as a TemplateException."""
        fake_api.route(
            "DELETE",
            "/templates/tags",
            404,
            {"code": 404, "message": "Template not found"},
        )

        with pytest.raises(TemplateException, match="404: Template not found"):
            await AsyncTemplate.remove_tags("nonexistent", ["tag"], **api_opts)


class TestGetTags:
    """Tests for AsyncTemplate.get_tags method."""

    async def test_get_tags(self, fake_api, api_opts):
        """The API's tag list is parsed into TemplateTag objects."""
        fake_api.route(
            "GET",
            "/templates/my-template/tags",
            200,
            [
                {
                    "tag": "v1.0",
                    "buildID": BUILD_ID,
                    "createdAt": "2024-01-15T10:30:00Z",
                },
                {
                    "tag": "latest",
                    "buildID": "11111111-1111-1111-1111-111111111111",
                    "createdAt": "2024-01-16T12:00:00Z",
                },
            ],
        )

        result = await AsyncTemplate.get_tags("my-template", **api_opts)

        assert [(t.tag, t.build_id, t.created_at) for t in result] == [
            ("v1.0", BUILD_ID, datetime(2024, 1, 15, 10, 30, tzinfo=timezone.utc)),
            (
                "latest",
                "11111111-1111-1111-1111-111111111111",
                datetime(2024, 1, 16, 12, 0, tzinfo=timezone.utc),
            ),
        ]

    async def test_get_tags_error(self, fake_api, api_opts):
        """A 404 from the API surfaces as a TemplateException."""
        fake_api.route(
            "GET",
            "/templates/nonexistent/tags",
            404,
            {"code": 404, "message": "Template not found"},
        )

        with pytest.raises(TemplateException, match="404: Template not found"):
            await AsyncTemplate.get_tags("nonexistent", **api_opts)


# Integration tests
class TestTagsIntegration:
    """Integration tests for AsyncTemplate tags functionality."""

    @pytest.mark.skip_debug()
    async def test_build_template_with_tags_assign_and_delete(self, async_build):
        """Test building a template with tags, assigning new tags, and deleting."""
        template_name = "e2b-tags-test"
        initial_tag = f"{template_name}:v1-{uuid.uuid4().hex}"

        # Build a template with initial tag
        template = Template().from_base_image()
        build_info = await async_build(template, name=initial_tag)

        assert build_info.build_id
        assert build_info.template_id

        # Assign additional tags
        tag_info = await AsyncTemplate.assign_tags(
            initial_tag, ["production", "latest"]
        )

        assert tag_info.build_id
        # API returns just the tag portion, not the full alias:tag
        assert "production" in tag_info.tags
        assert "latest" in tag_info.tags

    @pytest.mark.skip_debug()
    async def test_assign_single_tag_to_existing_template(self, async_build):
        """Test assigning a single tag (not array) to an existing template."""
        template_name = "e2b-tags-test"
        initial_tag = f"{template_name}:v1-{uuid.uuid4().hex}"

        template = Template().from_base_image()
        await async_build(template, name=initial_tag)

        # Assign single tag (not array)
        tag_info = await AsyncTemplate.assign_tags(initial_tag, "stable")

        assert tag_info.build_id
        # API returns just the tag portion, not the full alias:tag
        assert "stable" in tag_info.tags

    @pytest.mark.skip_debug()
    async def test_rejects_invalid_tag_format_missing_alias(self, async_build):
        """Test that tag without alias (starts with colon) is rejected."""
        template_name = "e2b-tags-test"
        initial_tag = f"{template_name}:v1-{uuid.uuid4().hex}"

        template = Template().from_base_image()
        await async_build(template, name=initial_tag)

        # Tag without alias (starts with colon) should be rejected
        with pytest.raises(Exception):
            await AsyncTemplate.assign_tags(initial_tag, ":invalid-tag")

    @pytest.mark.skip_debug()
    async def test_rejects_invalid_tag_format_missing_tag(self, async_build):
        """Test that tag without tag portion (ends with colon) is rejected."""
        template_name = "e2b-tags-test"
        initial_tag = f"{template_name}:v1-{uuid.uuid4().hex}"

        template = Template().from_base_image()
        await async_build(template, name=initial_tag)

        # Tag without tag portion (ends with colon) should be rejected
        with pytest.raises(Exception):
            await AsyncTemplate.assign_tags(initial_tag, f"{template_name}:")
