import uuid
from unittest.mock import patch

import pytest

from e2b import TagInfo, Template, default_build_logger


class TestAssignTag:
    """Tests for Template.assign_tag method."""

    @patch("e2b.template_sync.main.get_api_client")
    @patch("e2b.template_sync.main.assign_tag")
    def test_assign_single_tag(self, mock_assign_tag, mock_get_api_client):
        """Test assigning a single tag to a template."""
        mock_assign_tag.return_value = TagInfo(
            build_id="mock-build-id",
            tags=["my-template:production"],
        )

        result = Template.assign_tag("my-template:v1.0", "my-template:production")

        assert result.build_id == "mock-build-id"
        assert "my-template:production" in result.tags
        mock_assign_tag.assert_called_once()
        # Verify the names were converted to a list
        call_args = mock_assign_tag.call_args
        assert call_args[0][1] == "my-template:v1.0"  # target
        assert call_args[0][2] == ["my-template:production"]  # names as list

    @patch("e2b.template_sync.main.get_api_client")
    @patch("e2b.template_sync.main.assign_tag")
    def test_assign_multiple_tags(self, mock_assign_tag, mock_get_api_client):
        """Test assigning multiple tags to a template."""
        mock_assign_tag.return_value = TagInfo(
            build_id="mock-build-id",
            tags=["my-template:production", "my-template:stable"],
        )

        result = Template.assign_tag(
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
    """Tests for Template.delete_tag method."""

    @patch("e2b.template_sync.main.get_api_client")
    @patch("e2b.template_sync.main.delete_tag")
    def test_delete_tag(self, mock_delete_tag, mock_get_api_client):
        """Test deleting a tag from a template."""
        mock_delete_tag.return_value = None

        # Should not raise
        Template.delete_tag("my-template:production")

        mock_delete_tag.assert_called_once()
        call_args = mock_delete_tag.call_args
        assert call_args[0][1] == "my-template:production"

    @patch("e2b.template_sync.main.get_api_client")
    @patch("e2b.template_sync.main.delete_tag")
    def test_delete_tag_error(self, mock_delete_tag, mock_get_api_client):
        """Test that delete_tag raises an error for nonexistent tags."""
        from e2b.exceptions import TemplateException

        mock_delete_tag.side_effect = TemplateException("Tag not found")

        with pytest.raises(TemplateException):
            Template.delete_tag("nonexistent:tag")


# Integration tests - run with E2B_INTEGRATION_TEST=1
class TestTagsIntegration:
    """Integration tests for Template tags functionality."""

    test_run_id = uuid.uuid4().hex[:8]

    @pytest.mark.integration
    @pytest.mark.timeout(300)
    def test_build_template_with_tags_assign_and_delete(self):
        """Test building a template with tags, assigning new tags, and deleting."""
        template_alias = f"e2b-tags-test-{self.test_run_id}"
        initial_tag = f"{template_alias}:v1.0"

        # Build a template with initial tag
        template = Template().from_base_image()
        build_info = Template.build(
            template,
            initial_tag,
            cpu_count=1,
            memory_mb=1024,
            skip_cache=True,
            on_build_logs=default_build_logger(),
        )

        assert build_info.build_id
        assert build_info.template_id

        # Assign additional tags
        production_tag = f"{template_alias}:production"
        latest_tag = f"{template_alias}:latest"

        tag_info = Template.assign_tag(initial_tag, [production_tag, latest_tag])

        assert tag_info.build_id
        assert production_tag in tag_info.tags
        assert latest_tag in tag_info.tags

        # Delete tags
        Template.delete_tag(production_tag)

        # Verify error on non-existent tag
        with pytest.raises(Exception):
            Template.delete_tag(f"{template_alias}:nonexistent-{self.test_run_id}")

        # Clean up
        Template.delete_tag(initial_tag)
        Template.delete_tag(latest_tag)

    @pytest.mark.integration
    @pytest.mark.timeout(300)
    def test_assign_single_tag_to_existing_template(self):
        """Test assigning a single tag (not array) to an existing template."""
        template_alias = f"e2b-single-tag-{self.test_run_id}"
        initial_tag = f"{template_alias}:v1.0"

        template = Template().from_base_image()
        Template.build(
            template,
            initial_tag,
            cpu_count=1,
            memory_mb=1024,
            skip_cache=True,
        )

        # Assign single tag (not array)
        stable_tag = f"{template_alias}:stable"
        tag_info = Template.assign_tag(initial_tag, stable_tag)

        assert tag_info.build_id
        assert stable_tag in tag_info.tags

        # Clean up
        Template.delete_tag(initial_tag)
        Template.delete_tag(stable_tag)
