from e2b.sandbox.sandbox_api import normalize_mcp_config


def test_github_config_maps_snake_case_install_and_run_to_camel_case():
    config = {
        "github/tenuo-ai/tenuo-demos": {
            "install_cmd": "echo hi > /tmp/installed.txt",
            "run_cmd": "cat",
        }
    }

    normalized = normalize_mcp_config(config)

    assert normalized == {
        "github/tenuo-ai/tenuo-demos": {
            "installCmd": "echo hi > /tmp/installed.txt",
            "runCmd": "cat",
        }
    }


def test_github_config_preserves_envs_and_other_passthrough_fields():
    config = {
        "github/owner/repo": {
            "run_cmd": "python server.py",
            "install_cmd": "pip install -r requirements.txt",
            "envs": {"TOKEN": "secret"},
        }
    }

    normalized = normalize_mcp_config(config)

    assert normalized["github/owner/repo"] == {
        "runCmd": "python server.py",
        "installCmd": "pip install -r requirements.txt",
        "envs": {"TOKEN": "secret"},
    }


def test_github_config_leaves_already_camel_case_keys_untouched():
    config = {
        "github/owner/repo": {
            "installCmd": "pip install",
            "runCmd": "python main.py",
        }
    }

    normalized = normalize_mcp_config(config)

    assert normalized == config


def test_github_config_prefers_camel_case_when_both_forms_coexist():
    """A caller that explicitly set camelCase should not have it overwritten by an accidental
    snake_case field in the same entry; the explicit wire-format value wins."""
    config = {
        "github/owner/repo": {
            "install_cmd": "ignored install",
            "installCmd": "winning install",
            "run_cmd": "ignored run",
            "runCmd": "winning run",
        }
    }

    normalized = normalize_mcp_config(config)

    assert normalized == {
        "github/owner/repo": {
            "installCmd": "winning install",
            "runCmd": "winning run",
        }
    }


def test_non_github_entries_are_passed_through_unchanged():
    """`BaseMcpServer` entries (not keyed under `github/*`) must not be touched."""
    config = {
        "filesystem": {"path": "/tmp"},
        "sqlite": {"path": "/data/app.db"},
    }

    normalized = normalize_mcp_config(config)

    assert normalized == config


def test_empty_and_none_inputs_pass_through():
    assert normalize_mcp_config(None) is None
    assert normalize_mcp_config({}) == {}


def test_normalization_does_not_mutate_the_caller_dict():
    config = {
        "github/owner/repo": {
            "install_cmd": "pip install",
            "run_cmd": "python main.py",
        }
    }
    original = {k: dict(v) if isinstance(v, dict) else v for k, v in config.items()}

    normalize_mcp_config(config)

    assert config == original
