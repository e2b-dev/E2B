from typing import List

from codegen.tools.async_tool import async_tool
from session.playground import NodeJSPlayground
from playground_client.models.entry_info import EntryInfo


def encode_directory_listing(entries: List[EntryInfo]) -> str:
    return "\n".join(
        [
            f"{entry.name} - {'directory' if entry.is_dir else 'file'}"
            for entry in entries
        ]
    )


def create_filesystem_tools(playground: NodeJSPlayground, **kwargs):
    # Ensure that the function is a generator even if no tools are yielded
    yield from ()

    @async_tool("ReadFile")
    async def read_file(path: str) -> str:
        """Read content of the file from filesystem."""
        return await playground.read_file(path)

    yield read_file

    @async_tool("SaveFile")
    async def save_file(input: str) -> str:
        """Save content to a file in the filesystem.
        The input should be a path to a file followed by the content of the file.
        Separate the path and content by a newline character.
        """
        path, content = input.lstrip().split("\n", 1)

        await playground.write_file(path, content)
        return "File saved"

    yield save_file

    @async_tool("DeleteFile")
    async def delete_file(path: str) -> str:
        """Delete the file."""
        await playground.delete_file(path)
        return "File deleted"

    yield delete_file

    @async_tool("ListDirectory")
    async def list_directory(path: str) -> str:
        """List all files and subdirectories from the directory."""
        entries = await playground.list_dir(path)
        return encode_directory_listing(entries)

    yield list_directory

    @async_tool("DeleteDirectory")
    async def delete_directory(path: str) -> str:
        """Delete the directory."""
        await playground.delete_dir(path)
        return "Directory deleted"

    yield delete_directory
