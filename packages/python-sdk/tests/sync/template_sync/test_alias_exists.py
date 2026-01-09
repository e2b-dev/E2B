import uuid

import pytest

from e2b import Template


@pytest.mark.skip_debug()
def test_check_base_template_alias_exists():
    """Test that the base template alias exists."""
    exists = Template.alias_exists("base")
    assert exists is True


@pytest.mark.skip_debug()
def test_check_non_existing_alias():
    """Test that a non-existing alias returns False."""
    non_existing_alias = f"nonexistent-{uuid.uuid4()}"
    exists = Template.alias_exists(non_existing_alias)
    assert exists is False
