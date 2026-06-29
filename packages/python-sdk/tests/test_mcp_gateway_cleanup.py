"""
Tests for MCP gateway startup failure cleanup.

When the MCP gateway fails to start (non-zero exit code or exception),
the sandbox should be killed to prevent orphaned resources.
"""

import types
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from e2b.sandbox.commands.command_handle import CommandResult


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_command_result(exit_code: int, stderr: str = "") -> CommandResult:
    """Create a minimal CommandResult-like object."""
    result = types.SimpleNamespace()
    result.exit_code = exit_code
    result.stderr = stderr
    result.stdout = ""
    result.error = None
    return result


# ===========================================================================
# AsyncSandbox tests
# ===========================================================================


class TestAsyncSandboxMcpCleanup:
    """Tests for AsyncSandbox.create MCP gateway cleanup."""

    @pytest.fixture
    def mock_async_sandbox(self):
        """Create a mock AsyncSandbox instance with commands.run and kill."""
        sandbox = AsyncMock()
        sandbox._mcp_token = None
        sandbox.commands = AsyncMock()
        sandbox.kill = AsyncMock(return_value=True)
        return sandbox

    async def test_mcp_success_no_kill(self, mock_async_sandbox):
        """When MCP gateway starts successfully, sandbox.kill() should NOT be called."""
        mock_async_sandbox.commands.run = AsyncMock(
            return_value=_make_command_result(exit_code=0)
        )

        with patch(
            "e2b.sandbox_async.main.AsyncSandbox._create",
            new_callable=AsyncMock,
            return_value=mock_async_sandbox,
        ):
            from e2b.sandbox_async.main import AsyncSandbox

            sandbox = await AsyncSandbox.create(
                mcp={"exa": {}},
                api_key="e2b_" + "0" * 40,
                debug=True,
            )

            assert sandbox is mock_async_sandbox
            mock_async_sandbox.kill.assert_not_called()

    async def test_mcp_nonzero_exit_kills_sandbox(self, mock_async_sandbox):
        """When MCP gateway exits with non-zero code, sandbox should be killed."""
        mock_async_sandbox.commands.run = AsyncMock(
            return_value=_make_command_result(exit_code=1, stderr="gateway error")
        )

        with patch(
            "e2b.sandbox_async.main.AsyncSandbox._create",
            new_callable=AsyncMock,
            return_value=mock_async_sandbox,
        ):
            from e2b.sandbox_async.main import AsyncSandbox

            with pytest.raises(Exception, match="Failed to start MCP gateway"):
                await AsyncSandbox.create(
                    mcp={"exa": {}},
                    api_key="e2b_" + "0" * 40,
                    debug=True,
                )

            mock_async_sandbox.kill.assert_awaited_once()

    async def test_mcp_exception_kills_sandbox(self, mock_async_sandbox):
        """When commands.run raises an exception, sandbox should be killed."""
        mock_async_sandbox.commands.run = AsyncMock(
            side_effect=RuntimeError("connection lost")
        )

        with patch(
            "e2b.sandbox_async.main.AsyncSandbox._create",
            new_callable=AsyncMock,
            return_value=mock_async_sandbox,
        ):
            from e2b.sandbox_async.main import AsyncSandbox

            with pytest.raises(RuntimeError, match="connection lost"):
                await AsyncSandbox.create(
                    mcp={"exa": {}},
                    api_key="e2b_" + "0" * 40,
                    debug=True,
                )

            mock_async_sandbox.kill.assert_awaited_once()

    async def test_mcp_failure_propagates_original_error(self, mock_async_sandbox):
        """The original error should be re-raised even if kill also fails."""
        mock_async_sandbox.commands.run = AsyncMock(
            return_value=_make_command_result(exit_code=1, stderr="startup failed")
        )
        mock_async_sandbox.kill = AsyncMock(
            side_effect=RuntimeError("kill also failed")
        )

        with patch(
            "e2b.sandbox_async.main.AsyncSandbox._create",
            new_callable=AsyncMock,
            return_value=mock_async_sandbox,
        ):
            from e2b.sandbox_async.main import AsyncSandbox

            with pytest.raises(Exception, match="Failed to start MCP gateway"):
                await AsyncSandbox.create(
                    mcp={"exa": {}},
                    api_key="e2b_" + "0" * 40,
                    debug=True,
                )

            # kill was attempted even though it failed
            mock_async_sandbox.kill.assert_awaited_once()

    async def test_mcp_kill_failure_suppressed(self, mock_async_sandbox):
        """If kill() raises, the exception should be suppressed (best-effort cleanup)."""
        mock_async_sandbox.commands.run = AsyncMock(
            side_effect=RuntimeError("run failed")
        )
        mock_async_sandbox.kill = AsyncMock(
            side_effect=Exception("kill failed too")
        )

        with patch(
            "e2b.sandbox_async.main.AsyncSandbox._create",
            new_callable=AsyncMock,
            return_value=mock_async_sandbox,
        ):
            from e2b.sandbox_async.main import AsyncSandbox

            # Should raise the original error, not the kill error
            with pytest.raises(RuntimeError, match="run failed"):
                await AsyncSandbox.create(
                    mcp={"exa": {}},
                    api_key="e2b_" + "0" * 40,
                    debug=True,
                )

    async def test_no_mcp_no_gateway(self, mock_async_sandbox):
        """When mcp is None, no gateway startup or kill should happen."""
        with patch(
            "e2b.sandbox_async.main.AsyncSandbox._create",
            new_callable=AsyncMock,
            return_value=mock_async_sandbox,
        ):
            from e2b.sandbox_async.main import AsyncSandbox

            sandbox = await AsyncSandbox.create(
                api_key="e2b_" + "0" * 40,
                debug=True,
            )

            assert sandbox is mock_async_sandbox
            mock_async_sandbox.commands.run.assert_not_called()
            mock_async_sandbox.kill.assert_not_called()

    async def test_mcp_token_set_before_run(self, mock_async_sandbox):
        """The MCP token should be set on the sandbox before commands.run is called."""
        tokens_seen = []

        async def capture_run(*args, **kwargs):
            tokens_seen.append(mock_async_sandbox._mcp_token)
            return _make_command_result(exit_code=0)

        mock_async_sandbox.commands.run = capture_run

        with patch(
            "e2b.sandbox_async.main.AsyncSandbox._create",
            new_callable=AsyncMock,
            return_value=mock_async_sandbox,
        ):
            from e2b.sandbox_async.main import AsyncSandbox

            await AsyncSandbox.create(
                mcp={"exa": {}},
                api_key="e2b_" + "0" * 40,
                debug=True,
            )

            assert len(tokens_seen) == 1
            assert tokens_seen[0] is not None


# ===========================================================================
# Sandbox (sync) tests
# ===========================================================================


class TestSyncSandboxMcpCleanup:
    """Tests for Sandbox.create MCP gateway cleanup (sync version)."""

    @pytest.fixture
    def mock_sync_sandbox(self):
        """Create a mock Sandbox instance with commands.run and kill."""
        sandbox = MagicMock()
        sandbox._mcp_token = None
        sandbox.commands = MagicMock()
        sandbox.kill = MagicMock(return_value=True)
        return sandbox

    def test_mcp_success_no_kill(self, mock_sync_sandbox):
        """When MCP gateway starts successfully, sandbox.kill() should NOT be called."""
        mock_sync_sandbox.commands.run = MagicMock(
            return_value=_make_command_result(exit_code=0)
        )

        with patch(
            "e2b.sandbox_sync.main.Sandbox._create",
            return_value=mock_sync_sandbox,
        ):
            from e2b.sandbox_sync.main import Sandbox

            sandbox = Sandbox.create(
                mcp={"exa": {}},
                api_key="e2b_" + "0" * 40,
                debug=True,
            )

            assert sandbox is mock_sync_sandbox
            mock_sync_sandbox.kill.assert_not_called()

    def test_mcp_nonzero_exit_kills_sandbox(self, mock_sync_sandbox):
        """When MCP gateway exits with non-zero code, sandbox should be killed."""
        mock_sync_sandbox.commands.run = MagicMock(
            return_value=_make_command_result(exit_code=1, stderr="gateway error")
        )

        with patch(
            "e2b.sandbox_sync.main.Sandbox._create",
            return_value=mock_sync_sandbox,
        ):
            from e2b.sandbox_sync.main import Sandbox

            with pytest.raises(Exception, match="Failed to start MCP gateway"):
                Sandbox.create(
                    mcp={"exa": {}},
                    api_key="e2b_" + "0" * 40,
                    debug=True,
                )

            mock_sync_sandbox.kill.assert_called_once()

    def test_mcp_exception_kills_sandbox(self, mock_sync_sandbox):
        """When commands.run raises an exception, sandbox should be killed."""
        mock_sync_sandbox.commands.run = MagicMock(
            side_effect=RuntimeError("connection lost")
        )

        with patch(
            "e2b.sandbox_sync.main.Sandbox._create",
            return_value=mock_sync_sandbox,
        ):
            from e2b.sandbox_sync.main import Sandbox

            with pytest.raises(RuntimeError, match="connection lost"):
                Sandbox.create(
                    mcp={"exa": {}},
                    api_key="e2b_" + "0" * 40,
                    debug=True,
                )

            mock_sync_sandbox.kill.assert_called_once()

    def test_mcp_failure_propagates_original_error(self, mock_sync_sandbox):
        """The original error should be re-raised even if kill also fails."""
        mock_sync_sandbox.commands.run = MagicMock(
            return_value=_make_command_result(exit_code=1, stderr="startup failed")
        )
        mock_sync_sandbox.kill = MagicMock(
            side_effect=RuntimeError("kill also failed")
        )

        with patch(
            "e2b.sandbox_sync.main.Sandbox._create",
            return_value=mock_sync_sandbox,
        ):
            from e2b.sandbox_sync.main import Sandbox

            with pytest.raises(Exception, match="Failed to start MCP gateway"):
                Sandbox.create(
                    mcp={"exa": {}},
                    api_key="e2b_" + "0" * 40,
                    debug=True,
                )

            mock_sync_sandbox.kill.assert_called_once()

    def test_mcp_kill_failure_suppressed(self, mock_sync_sandbox):
        """If kill() raises, the exception should be suppressed (best-effort cleanup)."""
        mock_sync_sandbox.commands.run = MagicMock(
            side_effect=RuntimeError("run failed")
        )
        mock_sync_sandbox.kill = MagicMock(
            side_effect=Exception("kill failed too")
        )

        with patch(
            "e2b.sandbox_sync.main.Sandbox._create",
            return_value=mock_sync_sandbox,
        ):
            from e2b.sandbox_sync.main import Sandbox

            with pytest.raises(RuntimeError, match="run failed"):
                Sandbox.create(
                    mcp={"exa": {}},
                    api_key="e2b_" + "0" * 40,
                    debug=True,
                )

    def test_no_mcp_no_gateway(self, mock_sync_sandbox):
        """When mcp is None, no gateway startup or kill should happen."""
        with patch(
            "e2b.sandbox_sync.main.Sandbox._create",
            return_value=mock_sync_sandbox,
        ):
            from e2b.sandbox_sync.main import Sandbox

            sandbox = Sandbox.create(
                api_key="e2b_" + "0" * 40,
                debug=True,
            )

            assert sandbox is mock_sync_sandbox
            mock_sync_sandbox.commands.run.assert_not_called()
            mock_sync_sandbox.kill.assert_not_called()

    def test_mcp_token_set_before_run(self, mock_sync_sandbox):
        """The MCP token should be set on the sandbox before commands.run is called."""
        tokens_seen = []

        def capture_run(*args, **kwargs):
            tokens_seen.append(mock_sync_sandbox._mcp_token)
            return _make_command_result(exit_code=0)

        mock_sync_sandbox.commands.run = capture_run

        with patch(
            "e2b.sandbox_sync.main.Sandbox._create",
            return_value=mock_sync_sandbox,
        ):
            from e2b.sandbox_sync.main import Sandbox

            Sandbox.create(
                mcp={"exa": {}},
                api_key="e2b_" + "0" * 40,
                debug=True,
            )

            assert len(tokens_seen) == 1
            assert tokens_seen[0] is not None
