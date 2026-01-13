from unittest.mock import patch

import pytest

from e2b import AsyncTemplate, TagInfo


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
