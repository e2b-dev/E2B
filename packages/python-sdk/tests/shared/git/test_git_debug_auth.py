import os
import shlex

import pytest


if os.getenv("E2B_DEBUG_GIT_AUTH") is None:
    pytest.skip(
        "Set E2B_DEBUG_GIT_AUTH=1 to run debug-only git auth tests.",
        allow_module_level=True,
    )


HOST = "example.com"
PROTOCOL = "https"
USERNAME = "git"
PASSWORD = "token"
EXPECTED_CREDENTIAL = f"{PROTOCOL}://{USERNAME}:{PASSWORD}@{HOST}"
CONFIGURED_NAME = "E2B Debug"
CONFIGURED_EMAIL = "debug@e2b.dev"


def _quote(value: str) -> str:
    return shlex.quote(value)


def _get_config(sandbox, key: str) -> str:
    return sandbox.commands.run(f"git config --global --get {key} || true").stdout.strip()


def test_dangerously_authenticate_configures_global_credentials_and_user(
    sandbox_factory,
):
    sandbox = sandbox_factory(debug=True, secure=False, timeout=5)

    home = sandbox.commands.run("echo $HOME").stdout.strip()
    credentials_path = f"{home}/.git-credentials"
    credentials_backup_path = f"{credentials_path}.__bak__"

    original_helper = _get_config(sandbox, "credential.helper")
    original_name = _get_config(sandbox, "user.name")
    original_email = _get_config(sandbox, "user.email")

    sandbox.commands.run(
        f'if [ -f "{credentials_path}" ]; then cp "{credentials_path}" "{credentials_backup_path}"; else rm -f "{credentials_backup_path}"; fi'
    )

    try:
        sandbox.git.dangerously_authenticate(
            USERNAME,
            PASSWORD,
            host=HOST,
            protocol=PROTOCOL,
        )
        sandbox.git.configure_user(CONFIGURED_NAME, CONFIGURED_EMAIL)

        helper_after = _get_config(sandbox, "credential.helper")
        assert helper_after == "store"

        credential_check = sandbox.commands.run(
            f'if [ -f "{credentials_path}" ] && grep -F {_quote(EXPECTED_CREDENTIAL)} "{credentials_path}" >/dev/null; then echo found; else echo missing; fi'
        ).stdout.strip()
        assert credential_check == "found"

        name_after = _get_config(sandbox, "user.name")
        email_after = _get_config(sandbox, "user.email")
        assert name_after == CONFIGURED_NAME
        assert email_after == CONFIGURED_EMAIL
    finally:
        helper_restore_cmd = (
            f"git config --global credential.helper {_quote(original_helper)}"
            if original_helper
            else "git config --global --unset credential.helper || true"
        )
        name_restore_cmd = (
            f"git config --global user.name {_quote(original_name)}"
            if original_name
            else "git config --global --unset user.name || true"
        )
        email_restore_cmd = (
            f"git config --global user.email {_quote(original_email)}"
            if original_email
            else "git config --global --unset user.email || true"
        )

        sandbox.commands.run(helper_restore_cmd)
        sandbox.commands.run(name_restore_cmd)
        sandbox.commands.run(email_restore_cmd)
        sandbox.commands.run(
            f'if [ -f "{credentials_backup_path}" ]; then mv "{credentials_backup_path}" "{credentials_path}"; else rm -f "{credentials_path}"; fi'
        )
