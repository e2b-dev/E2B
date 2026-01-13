import uuid

import pytest

from e2b import Template, default_build_logger
from e2b.exceptions import TemplateException


# Generate a unique test ID for this test run
test_run_id = str(uuid.uuid4())[:8]


@pytest.mark.skip_debug()
def test_build_template_with_tags_and_manage_them():
    """Test building a template with tags and managing them."""
    template_alias = f"e2b-tags-test-{test_run_id}"
    initial_tag = f"{template_alias}:v1.0"

    print(f"Building template with tag: {initial_tag}")

    template = Template().from_base_image()

    build_info = Template.build(
        template,
        initial_tag,
        cpu_count=1,
        memory_mb=1024,
        skip_cache=True,
        on_build_logs=default_build_logger(),
    )

    print(f"Build completed: {build_info}")
    assert build_info.build_id, "Build ID should be present"
    assert build_info.template_id, "Template ID should be present"

    # Assign additional tags to the build
    production_tag = f"{template_alias}:production"
    latest_tag = f"{template_alias}:latest"

    print(f"Assigning tags: {production_tag}, {latest_tag}")

    tag_info = Template.assign_tag(initial_tag, [production_tag, latest_tag])

    print(f"Tag assignment result: {tag_info}")
    assert tag_info.build_id, "Tag info should have build ID"
    assert production_tag in tag_info.tags, "Should include production tag"
    assert latest_tag in tag_info.tags, "Should include latest tag"

    # Delete one of the tags
    print(f"Deleting tag: {production_tag}")
    Template.delete_tag(production_tag)
    print("Tag deleted successfully")

    # Verify that deleting a non-existent tag throws an error
    print("Verifying that deleting non-existent tag throws error")
    with pytest.raises(TemplateException):
        Template.delete_tag(f"{template_alias}:nonexistent-tag-{test_run_id}")
    print("Expected error received for non-existent tag")

    # Clean up - delete remaining tags
    print("Cleaning up remaining tags")
    Template.delete_tag(initial_tag)
    Template.delete_tag(latest_tag)
    print("Cleanup completed")


@pytest.mark.skip_debug()
def test_assign_single_tag_to_existing_template():
    """Test assigning a single tag (not array) to existing template."""
    template_alias = f"e2b-single-tag-test-{test_run_id}"
    initial_tag = f"{template_alias}:v1.0"

    print(f"Building template with tag: {initial_tag}")

    template = Template().from_base_image()

    Template.build(
        template,
        initial_tag,
        cpu_count=1,
        memory_mb=1024,
        skip_cache=True,
    )

    # Assign a single tag (not array)
    stable_tag = f"{template_alias}:stable"
    print(f"Assigning single tag: {stable_tag}")

    tag_info = Template.assign_tag(initial_tag, stable_tag)

    assert tag_info.build_id, "Tag info should have build ID"
    assert stable_tag in tag_info.tags, "Should include stable tag"

    # Clean up
    Template.delete_tag(initial_tag)
    Template.delete_tag(stable_tag)
    print("Test completed and cleaned up")
