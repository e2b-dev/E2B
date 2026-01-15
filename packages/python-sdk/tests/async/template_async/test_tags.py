import uuid

import pytest

from e2b import AsyncTemplate, TemplateTagInfo, Template
from e2b.exceptions import TemplateException
import e2b.template_async.main as template_async_main


class TestAssignTag:
    """Tests for AsyncTemplate.assign_tag method."""

    @pytest.mark.asyncio
    async def test_assign_single_tag(self, monkeypatch):
        """Test assigning a single tag to a template."""
        call_args_capture = []

        async def mock_assign_tag(client, target, names):
            call_args_capture.append((client, target, names))
            return TemplateTagInfo(
                build_id="00000000-0000-0000-0000-000000000000",
                names=["my-template:production"],
            )

        monkeypatch.setattr(
            template_async_main, "get_api_client", lambda *args, **kwargs: None
        )
        monkeypatch.setattr(template_async_main, "assign_tag", mock_assign_tag)

        result = await AsyncTemplate.assign_tag(
            "my-template:v1.0", "my-template:production"
        )

        assert result.build_id == "00000000-0000-0000-0000-000000000000"
        assert "my-template:production" in result.names
        assert len(call_args_capture) == 1
        # Verify the names were converted to a list
        _, target, names = call_args_capture[0]
        assert target == "my-template:v1.0"
        assert names == ["my-template:production"]

    @pytest.mark.asyncio
    async def test_assign_multiple_tags(self, monkeypatch):
        """Test assigning multiple tags to a template."""
        call_args_capture = []

        async def mock_assign_tag(client, target, names):
            call_args_capture.append((client, target, names))
            return TemplateTagInfo(
                build_id="00000000-0000-0000-0000-000000000000",
                names=["my-template:production", "my-template:stable"],
            )

        monkeypatch.setattr(
            template_async_main, "get_api_client", lambda *args, **kwargs: None
        )
        monkeypatch.setattr(template_async_main, "assign_tag", mock_assign_tag)

        result = await AsyncTemplate.assign_tag(
            "my-template:v1.0", ["my-template:production", "my-template:stable"]
        )

        assert result.build_id == "00000000-0000-0000-0000-000000000000"
        assert "my-template:production" in result.names
        assert "my-template:stable" in result.names
        assert len(call_args_capture) == 1
        # Verify the names were passed as-is (already a list)
        _, _, names = call_args_capture[0]
        assert names == ["my-template:production", "my-template:stable"]


class TestDeleteTag:
    """Tests for AsyncTemplate.remove_tag method."""

    @pytest.mark.asyncio
    async def test_remove_tag(self, monkeypatch):
        """Test deleting a tag from a template."""
        call_args_capture = []

        async def mock_remove_tag(client, name):
            call_args_capture.append((client, name))
            return None

        monkeypatch.setattr(
            template_async_main, "get_api_client", lambda *args, **kwargs: None
        )
        monkeypatch.setattr(template_async_main, "remove_tag", mock_remove_tag)

        # Should not raise
        await AsyncTemplate.remove_tag("my-template:production")

        assert len(call_args_capture) == 1
        _, name = call_args_capture[0]
        assert name == "my-template:production"

    @pytest.mark.asyncio
    async def test_remove_tag_error(self, monkeypatch):
        """Test that remove_tag raises an error for nonexistent tags."""

        async def mock_remove_tag(client, name):
            raise TemplateException("Tag not found")

        monkeypatch.setattr(
            template_async_main, "get_api_client", lambda *args, **kwargs: None
        )
        monkeypatch.setattr(template_async_main, "remove_tag", mock_remove_tag)

        with pytest.raises(TemplateException):
            await AsyncTemplate.remove_tag("nonexistent:tag")


# Integration tests
class TestTagsIntegration:
    """Integration tests for AsyncTemplate tags functionality."""

    @pytest.mark.skip_debug()
    async def test_build_template_with_tags_assign_and_delete(self, async_build):
        """Test building a template with tags, assigning new tags, and deleting."""
        template_alias = f"e2b-async-tags-test-{uuid.uuid4().hex}"
        initial_tag = f"{template_alias}:v1.0"

        # Build a template with initial tag
        template = Template().from_base_image()
        build_info = await async_build(template, name=initial_tag)

        assert build_info.build_id
        assert build_info.template_id

        # Assign additional tags
        production_tag = f"{template_alias}:production"
        latest_tag = f"{template_alias}:latest"

        tag_info = await AsyncTemplate.assign_tag(
            initial_tag, [production_tag, latest_tag]
        )

        assert tag_info.build_id
        # API returns just the tag portion, not the full alias:tag
        assert "production" in tag_info.names
        assert "latest" in tag_info.names

        # Delete tags
        await AsyncTemplate.remove_tag(production_tag)

        # Clean up
        await AsyncTemplate.remove_tag(initial_tag)
        await AsyncTemplate.remove_tag(latest_tag)

    @pytest.mark.skip_debug()
    async def test_assign_single_tag_to_existing_template(self, async_build):
        """Test assigning a single tag (not array) to an existing template."""
        template_alias = f"e2b-async-single-tag-{uuid.uuid4().hex}"
        initial_tag = f"{template_alias}:v1.0"

        template = Template().from_base_image()
        await async_build(template, name=initial_tag)

        # Assign single tag (not array)
        stable_tag = f"{template_alias}:stable"
        tag_info = await AsyncTemplate.assign_tag(initial_tag, stable_tag)

        assert tag_info.build_id
        # API returns just the tag portion, not the full alias:tag
        assert "stable" in tag_info.names

        # Clean up
        await AsyncTemplate.remove_tag(initial_tag)
        await AsyncTemplate.remove_tag(stable_tag)

    @pytest.mark.skip_debug()
    async def test_rejects_invalid_tag_format_missing_alias(self, async_build):
        """Test that tag without alias (starts with colon) is rejected."""
        template_alias = f"e2b-async-invalid-tag-{uuid.uuid4().hex}"
        initial_tag = f"{template_alias}:v1.0"

        template = Template().from_base_image()
        await async_build(template, name=initial_tag)

        # Tag without alias (starts with colon) should be rejected
        with pytest.raises(Exception):
            await AsyncTemplate.assign_tag(initial_tag, ":invalid-tag")

        # Clean up
        await AsyncTemplate.remove_tag(initial_tag)

    @pytest.mark.skip_debug()
    async def test_rejects_invalid_tag_format_missing_tag(self, async_build):
        """Test that tag without tag portion (ends with colon) is rejected."""
        template_alias = f"e2b-async-invalid-tag2-{uuid.uuid4().hex}"
        initial_tag = f"{template_alias}:v1.0"

        template = Template().from_base_image()
        await async_build(template, name=initial_tag)

        # Tag without tag portion (ends with colon) should be rejected
        with pytest.raises(Exception):
            await AsyncTemplate.assign_tag(initial_tag, f"{template_alias}:")

        # Clean up
        await AsyncTemplate.remove_tag(initial_tag)
