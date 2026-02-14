import uuid
from datetime import datetime, timezone
from unittest.mock import Mock

import pytest

from e2b import TemplateTag, TemplateTagInfo, Template
from e2b.exceptions import TemplateException
import e2b.template_sync.main as template_sync_main


class TestAssignTags:
    """Tests for Template.assign_tags method."""

    def test_assign_single_tag(self, monkeypatch):
        """Test assigning a single tag to a template."""
        mock_assign_tags = Mock(
            return_value=TemplateTagInfo(
                build_id="00000000-0000-0000-0000-000000000000",
                tags=["production"],
            )
        )

        monkeypatch.setattr(
            template_sync_main, "get_api_client", lambda *args, **kwargs: None
        )
        monkeypatch.setattr(template_sync_main, "assign_tags", mock_assign_tags)

        result = Template.assign_tags("my-template:v1.0", "production")

        assert result.build_id == "00000000-0000-0000-0000-000000000000"
        assert "production" in result.tags
        mock_assign_tags.assert_called_once()
        _, target, tags = mock_assign_tags.call_args[0]
        assert target == "my-template:v1.0"
        assert tags == ["production"]

    def test_assign_multiple_tags(self, monkeypatch):
        """Test assigning multiple tags to a template."""
        mock_assign_tags = Mock(
            return_value=TemplateTagInfo(
                build_id="00000000-0000-0000-0000-000000000000",
                tags=["production", "stable"],
            )
        )

        monkeypatch.setattr(
            template_sync_main, "get_api_client", lambda *args, **kwargs: None
        )
        monkeypatch.setattr(template_sync_main, "assign_tags", mock_assign_tags)

        result = Template.assign_tags("my-template:v1.0", ["production", "stable"])

        assert result.build_id == "00000000-0000-0000-0000-000000000000"
        assert "production" in result.tags
        assert "stable" in result.tags
        mock_assign_tags.assert_called_once()
        _, _, tags = mock_assign_tags.call_args[0]
        assert tags == ["production", "stable"]


class TestRemoveTags:
    """Tests for Template.remove_tags method."""

    def test_remove_single_tag(self, monkeypatch):
        """Test deleting a single tag from a template."""
        mock_remove_tags = Mock(return_value=None)

        monkeypatch.setattr(
            template_sync_main, "get_api_client", lambda *args, **kwargs: None
        )
        monkeypatch.setattr(template_sync_main, "remove_tags", mock_remove_tags)

        Template.remove_tags("my-template", "production")

        mock_remove_tags.assert_called_once()
        _, name, tags = mock_remove_tags.call_args[0]
        assert name == "my-template"
        assert tags == ["production"]

    def test_remove_multiple_tags(self, monkeypatch):
        """Test deleting multiple tags from a template."""
        mock_remove_tags = Mock(return_value=None)

        monkeypatch.setattr(
            template_sync_main, "get_api_client", lambda *args, **kwargs: None
        )
        monkeypatch.setattr(template_sync_main, "remove_tags", mock_remove_tags)

        Template.remove_tags("my-template", ["production", "staging"])

        mock_remove_tags.assert_called_once()
        _, name, tags = mock_remove_tags.call_args[0]
        assert name == "my-template"
        assert tags == ["production", "staging"]

    def test_remove_tags_error(self, monkeypatch):
        """Test that remove_tags raises an error for nonexistent template."""
        mock_remove_tags = Mock(side_effect=TemplateException("Template not found"))

        monkeypatch.setattr(
            template_sync_main, "get_api_client", lambda *args, **kwargs: None
        )
        monkeypatch.setattr(template_sync_main, "remove_tags", mock_remove_tags)

        with pytest.raises(TemplateException):
            Template.remove_tags("nonexistent", ["tag"])


class TestGetTags:
    """Tests for Template.get_tags method."""

    def test_get_tags(self, monkeypatch):
        """Test getting tags for a template."""
        mock_get_template_tags = Mock(
            return_value=[
                TemplateTag(
                    tag="v1.0",
                    build_id="00000000-0000-0000-0000-000000000000",
                    created_at=datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc),
                ),
                TemplateTag(
                    tag="latest",
                    build_id="11111111-1111-1111-1111-111111111111",
                    created_at=datetime(2024, 1, 16, 12, 0, 0, tzinfo=timezone.utc),
                ),
            ]
        )

        monkeypatch.setattr(
            template_sync_main, "get_api_client", lambda *args, **kwargs: None
        )
        monkeypatch.setattr(
            template_sync_main, "get_template_tags", mock_get_template_tags
        )

        result = Template.get_tags("my-template")

        assert len(result) == 2
        assert result[0].tag == "v1.0"
        assert result[0].build_id == "00000000-0000-0000-0000-000000000000"
        assert isinstance(result[0].created_at, datetime)
        assert result[1].tag == "latest"
        mock_get_template_tags.assert_called_once()

    def test_get_tags_error(self, monkeypatch):
        """Test that get_tags raises an error for nonexistent template."""
        mock_get_template_tags = Mock(
            side_effect=TemplateException("Template not found")
        )

        monkeypatch.setattr(
            template_sync_main, "get_api_client", lambda *args, **kwargs: None
        )
        monkeypatch.setattr(
            template_sync_main, "get_template_tags", mock_get_template_tags
        )

        with pytest.raises(TemplateException):
            Template.get_tags("nonexistent")


# Integration tests
class TestTagsIntegration:
    """Integration tests for Template tags functionality."""

    @pytest.mark.skip_debug()
    def test_build_template_with_tags_assign_and_delete(self, build):
        """Test building a template with tags, assigning new tags, and deleting."""
        template_alias = f"e2b-sync-tags-test-{uuid.uuid4().hex}"
        initial_tag = f"{template_alias}:v1.0"

        # Build a template with initial tag
        template = Template().from_base_image()
        build_info = build(template, name=initial_tag)

        assert build_info.build_id
        assert build_info.template_id

        # Assign additional tags
        tag_info = Template.assign_tags(initial_tag, ["production", "latest"])

        assert tag_info.build_id
        # API returns just the tag portion, not the full alias:tag
        assert "production" in tag_info.tags
        assert "latest" in tag_info.tags

    @pytest.mark.skip_debug()
    def test_assign_single_tag_to_existing_template(self, build):
        """Test assigning a single tag (not array) to an existing template."""
        template_alias = f"e2b-sync-single-tag-{uuid.uuid4().hex}"
        initial_tag = f"{template_alias}:v1.0"

        template = Template().from_base_image()
        build(template, name=initial_tag)

        # Assign single tag (not array)
        tag_info = Template.assign_tags(initial_tag, "stable")

        assert tag_info.build_id
        # API returns just the tag portion, not the full alias:tag
        assert "stable" in tag_info.tags

    @pytest.mark.skip_debug()
    def test_rejects_invalid_tag_format_missing_alias(self, build):
        """Test that tag without alias (starts with colon) is rejected."""
        template_alias = f"e2b-sync-invalid-tag-{uuid.uuid4().hex}"
        initial_tag = f"{template_alias}:v1.0"

        template = Template().from_base_image()
        build(template, name=initial_tag)

        # Tag without alias (starts with colon) should be rejected
        with pytest.raises(Exception):
            Template.assign_tags(initial_tag, ":invalid-tag")

    @pytest.mark.skip_debug()
    def test_rejects_invalid_tag_format_missing_tag(self, build):
        """Test that tag without tag portion (ends with colon) is rejected."""
        template_alias = f"e2b-sync-invalid-tag2-{uuid.uuid4().hex}"
        initial_tag = f"{template_alias}:v1.0"

        template = Template().from_base_image()
        build(template, name=initial_tag)

        # Tag without tag portion (ends with colon) should be rejected
        with pytest.raises(Exception):
            Template.assign_tags(initial_tag, f"{template_alias}:")
