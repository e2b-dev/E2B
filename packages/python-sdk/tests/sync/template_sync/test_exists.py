import uuid

import pytest

from e2b import Template


@pytest.mark.skip_debug()
def test_check_base_template_name_exists():
    """Test that the base template name exists."""
    exists = Template.exists("base")
    assert exists is True


@pytest.mark.skip_debug()
def test_check_non_existing_name():
    """Test that a non-existing name returns False."""
    non_existing_name = f"nonexistent-{uuid.uuid4()}"
    exists = Template.exists(non_existing_name)
    assert exists is False
