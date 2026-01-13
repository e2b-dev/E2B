import uuid
from unittest.mock import patch

import pytest

from e2b import AsyncTemplate, TagInfo, Template


class TestAssignTag:
    """Tests for AsyncTemplate.assign_tag method."""

    @pytest.mark.asyncio
    @patch("e2b.template_async.main.get_api_client")
    @patch("e2b.template_async.main.assign_tag")
    async def test_assign_single_tag(self, mock_assign_tag, mock_get_api_client):
        """Test assigning a single tag to a template."""
        mock_assign_tag.return_value = TagInfo(
            build_id="mock-build-id",
            tags=["my-template:production"],
        )

        result = await AsyncTemplate.assign_tag(
            "my-template:v1.0", "my-template:production"
        )

        assert result.build_id == "mock-build-id"
        assert "my-template:production" in result.tags
        mock_assign_tag.assert_called_once()
        # Verify the names were converted to a list
        call_args = mock_assign_tag.call_args
        assert call_args[0][1] == "my-template:v1.0"  # target
        assert call_args[0][2] == ["my-template:production"]  # names as list

    @pytest.mark.asyncio
    @patch("e2b.template_async.main.get_api_client")
    @patch("e2b.template_async.main.assign_tag")
    async def test_assign_multiple_tags(self, mock_assign_tag, mock_get_api_client):
        """Test assigning multiple tags to a template."""
        mock_assign_tag.return_value = TagInfo(
            build_id="mock-build-id",
            tags=["my-template:production", "my-template:stable"],
        )

        result = await AsyncTemplate.assign_tag(
            "my-template:v1.0", ["my-template:production", "my-template:stable"]
        )

        assert result.build_id == "mock-build-id"
        assert "my-template:production" in result.tags
        assert "my-template:stable" in result.tags
        mock_assign_tag.assert_called_once()
        # Verify the names were passed as-is (already a list)
        call_args = mock_assign_tag.call_args
        assert call_args[0][2] == ["my-template:production", "my-template:stable"]


class TestDeleteTag:
    """Tests for AsyncTemplate.delete_tag method."""

    @pytest.mark.asyncio
    @patch("e2b.template_async.main.get_api_client")
    @patch("e2b.template_async.main.delete_tag")
    async def test_delete_tag(self, mock_delete_tag, mock_get_api_client):
        """Test deleting a tag from a template."""
        mock_delete_tag.return_value = None

        # Should not raise
        await AsyncTemplate.delete_tag("my-template:production")

        mock_delete_tag.assert_called_once()
        call_args = mock_delete_tag.call_args
        assert call_args[0][1] == "my-template:production"

    @pytest.mark.asyncio
    @patch("e2b.template_async.main.get_api_client")
    @patch("e2b.template_async.main.delete_tag")
    async def test_delete_tag_error(self, mock_delete_tag, mock_get_api_client):
        """Test that delete_tag raises an error for nonexistent tags."""
        from e2b.exceptions import TemplateException

        mock_delete_tag.side_effect = TemplateException("Tag not found")

        with pytest.raises(TemplateException):
            await AsyncTemplate.delete_tag("nonexistent:tag")


# Integration tests
class TestTagsIntegration:
    """Integration tests for AsyncTemplate tags functionality."""

    test_run_id = uuid.uuid4().hex[:8]

    @pytest.mark.skip_debug()
    async def test_build_template_with_tags_assign_and_delete(self, async_build):
        """Test building a template with tags, assigning new tags, and deleting."""
        template_alias = f"e2b-async-tags-test-{self.test_run_id}"
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
        assert production_tag in tag_info.tags
        assert latest_tag in tag_info.tags

        # Delete tags
        await AsyncTemplate.delete_tag(production_tag)

        # Verify error on non-existent tag
        with pytest.raises(Exception):
            await AsyncTemplate.delete_tag(
                f"{template_alias}:nonexistent-{self.test_run_id}"
            )

        # Clean up
        await AsyncTemplate.delete_tag(initial_tag)
        await AsyncTemplate.delete_tag(latest_tag)

    @pytest.mark.skip_debug()
    async def test_assign_single_tag_to_existing_template(self, async_build):
        """Test assigning a single tag (not array) to an existing template."""
        template_alias = f"e2b-async-single-tag-{self.test_run_id}"
        initial_tag = f"{template_alias}:v1.0"

        template = Template().from_base_image()
        await async_build(template, name=initial_tag)

        # Assign single tag (not array)
        stable_tag = f"{template_alias}:stable"
        tag_info = await AsyncTemplate.assign_tag(initial_tag, stable_tag)

        assert tag_info.build_id
        assert stable_tag in tag_info.tags

        # Clean up
        await AsyncTemplate.delete_tag(initial_tag)
        await AsyncTemplate.delete_tag(stable_tag)
