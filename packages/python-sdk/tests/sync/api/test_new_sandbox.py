from e2b.api.client.models.new_sandbox import NewSandbox
from e2b.api.client.types import UNSET


def test_new_sandbox_includes_auto_resume_when_set():
    payload = NewSandbox(template_id="base", auto_resume="authed").to_dict()

    assert payload["autoResume"] == "authed"


def test_new_sandbox_omits_auto_resume_when_unset():
    payload = NewSandbox(template_id="base", auto_resume=UNSET).to_dict()

    assert "autoResume" not in payload


def test_new_sandbox_omits_auto_resume_when_none():
    payload = NewSandbox(template_id="base", auto_resume=None).to_dict()

    assert "autoResume" not in payload
