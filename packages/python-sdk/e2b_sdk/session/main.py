from typing import Optional

from e2b_sdk.session.session_connection import SessionConnection, SessionConnectionOpts
from e2b_sdk.session.code_snippet import CodeSnippetManager, CodeSnippetOpts
from e2b_sdk.session.terminal import TerminalManager
from e2b_sdk.session.filesystem import FilesystemManager
from e2b_sdk.session.process import ProcessManager


class SessionOpts(SessionConnectionOpts):
    code_snippet: Optional[CodeSnippetOpts] = None


class Session(SessionConnection):
    terminal: Optional[TerminalManager] = None
    filesystem: Optional[FilesystemManager] = None
    process: Optional[ProcessManager] = None
    code_snippet: Optional[CodeSnippetManager] = None

    opts = SessionOpts

    async def open(self):
        await super().open()

        self.code_snippet = await CodeSnippetManager(
            session_connection=self, opts=self.opts.code_snippet
        )._subscribe()
        self.terminal = TerminalManager(session_connection=self)
        self.filesystem = FilesystemManager(session_connection=self)
        self.process = ProcessManager(session_connection=self)
