import uuid
from unittest.mock import AsyncMock

import pytest

from e2b import AsyncTemplate, TemplateTagInfo, Template
from e2b.exceptions import TemplateException
import e2b.template_async.main as template_async_main


class TestAssignTags:
    """Tests for AsyncTemplate.assign_tags method."""

    @pytest.mark.asyncio
    async def test_assign_single_tag(self, monkeypatch):
        """Test assigning a single tag to a template."""
        mock_assign_tags = AsyncMock(
            return_value=TemplateTagInfo(
                build_id="00000000-0000-0000-0000-000000000000",
                tags=["production"],
            )
        )

        monkeypatch.setattr(
            template_async_main, "get_api_client", lambda *args, **kwargs: None
        )
        monkeypatch.setattr(template_async_main, "assign_tags", mock_assign_tags)

        result = await AsyncTemplate.assign_tags("my-template:v1.0", "production")

        assert result.build_id == "00000000-0000-0000-0000-000000000000"
        assert "production" in result.tags
        mock_assign_tags.assert_called_once()
        _, target, tags = mock_assign_tags.call_args[0]
        assert target == "my-template:v1.0"
        assert tags == ["production"]

    @pytest.mark.asyncio
    async def test_assign_multiple_tags(self, monkeypatch):
        """Test assigning multiple tags to a template."""
        mock_assign_tags = AsyncMock(
            return_value=TemplateTagInfo(
                build_id="00000000-0000-0000-0000-000000000000",
                tags=["production", "stable"],
            )
        )

        monkeypatch.setattr(
            template_async_main, "get_api_client", lambda *args, **kwargs: None
        )
        monkeypatch.setattr(template_async_main, "assign_tags", mock_assign_tags)

        result = await AsyncTemplate.assign_tags(
            "my-template:v1.0", ["production", "stable"]
        )

        assert result.build_id == "00000000-0000-0000-0000-000000000000"
        assert "production" in result.tags
        assert "stable" in result.tags
        mock_assign_tags.assert_called_once()
        _, _, tags = mock_assign_tags.call_args[0]
        assert tags == ["production", "stable"]


class TestRemoveTags:
    """Tests for AsyncTemplate.remove_tags method."""

    @pytest.mark.asyncio
    async def test_remove_single_tag(self, monkeypatch):
        """Test deleting a single tag from a template."""
        mock_remove_tags = AsyncMock(return_value=None)

        monkeypatch.setattr(
            template_async_main, "get_api_client", lambda *args, **kwargs: None
        )
        monkeypatch.setattr(template_async_main, "remove_tags", mock_remove_tags)

        await AsyncTemplate.remove_tags("my-template", "production")

        mock_remove_tags.assert_called_once()
        _, name, tags = mock_remove_tags.call_args[0]
        assert name == "my-template"
        assert tags == ["production"]

    @pytest.mark.asyncio
    async def test_remove_multiple_tags(self, monkeypatch):
        """Test deleting multiple tags from a template."""
        mock_remove_tags = AsyncMock(return_value=None)

        monkeypatch.setattr(
            template_async_main, "get_api_client", lambda *args, **kwargs: None
        )
        monkeypatch.setattr(template_async_main, "remove_tags", mock_remove_tags)

        await AsyncTemplate.remove_tags("my-template", ["production", "staging"])

        mock_remove_tags.assert_called_once()
        _, name, tags = mock_remove_tags.call_args[0]
        assert name == "my-template"
        assert tags == ["production", "staging"]

    @pytest.mark.asyncio
    async def test_remove_tags_error(self, monkeypatch):
        """Test that remove_tags raises an error for nonexistent template."""
        mock_remove_tags = AsyncMock(
            side_effect=TemplateException("Template not found")
        )

        monkeypatch.setattr(
            template_async_main, "get_api_client", lambda *args, **kwargs: None
        )
        monkeypatch.setattr(template_async_main, "remove_tags", mock_remove_tags)

        with pytest.raises(TemplateException):
            await AsyncTemplate.remove_tags("nonexistent", ["tag"])


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
        template_alias = f"e2b-async-single-tag-{uuid.uuid4().hex}"
        initial_tag = f"{template_alias}:v1.0"

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
        template_alias = f"e2b-async-invalid-tag-{uuid.uuid4().hex}"
        initial_tag = f"{template_alias}:v1.0"

        template = Template().from_base_image()
        await async_build(template, name=initial_tag)

        # Tag without alias (starts with colon) should be rejected
        with pytest.raises(Exception):
            await AsyncTemplate.assign_tags(initial_tag, ":invalid-tag")

    @pytest.mark.skip_debug()
    async def test_rejects_invalid_tag_format_missing_tag(self, async_build):
        """Test that tag without tag portion (ends with colon) is rejected."""
        template_alias = f"e2b-async-invalid-tag2-{uuid.uuid4().hex}"
        initial_tag = f"{template_alias}:v1.0"

        template = Template().from_base_image()
        await async_build(template, name=initial_tag)

        # Tag without tag portion (ends with colon) should be rejected
        with pytest.raises(Exception):
            await AsyncTemplate.assign_tags(initial_tag, f"{template_alias}:")
