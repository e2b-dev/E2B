import uuid

import pytest

from e2b import AsyncTemplate


@pytest.mark.skip_debug()
async def test_check_base_template_name_exists():
    """Test that the base template name exists."""
    exists = await AsyncTemplate.exists("base")
    assert exists is True


@pytest.mark.skip_debug()
async def test_check_base_template_with_tag_exists():
    """Test that the base template with tag exists."""
    exists = await AsyncTemplate.exists("base:default")
    assert exists is True


@pytest.mark.skip_debug()
async def test_check_non_existing_name():
    """Test that a non-existing name returns False."""
    non_existing_name = f"nonexistent-{uuid.uuid4()}"
    exists = await AsyncTemplate.exists(non_existing_name)
    assert exists is False
