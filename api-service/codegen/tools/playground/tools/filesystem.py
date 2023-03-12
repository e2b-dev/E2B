from langchain.agents import tool
from typing import List

from codegen.tools.playground.playground import NodeJSPlayground, FilesystemEntry


def encode_directory_listing(entries: List[FilesystemEntry]) -> str:
    return "\n".join([f"{entry.name} {entry.type}" for entry in entries])


def create_filesystem_tools(playground: NodeJSPlayground):
    @tool("ReadFile")
    def read_file(path: str) -> str:
        """Read content of the file from filesystem."""
        return playground.read_file(path)

    yield read_file

    # TODO: Escape file content?
    @tool("WriteFile")
    def write_file(input: str) -> str:
        """Write content to a file in the filesystem.
        The input should be a path to a file followed by the content of the file.
        Separate the path and content by a newline character.
        """
        path, content = input.split("\n", 1)
        playground.write_file(path, content)
        return ""

    yield write_file

    @tool("DeleteFile")
    def delete_file(path: str) -> str:
        """Delete the file."""
        playground.delete_file(path)
        return ""

    yield delete_file

    @tool("ListDirectory")
    def list_directory(path: str) -> str:
        """List all files and subdirectories from the directory."""
        entries = playground.list_dir(path)
        return encode_directory_listing(entries)

    yield list_directory

    @tool("DeleteDirectory")
    def delete_directory(path: str) -> str:
        """Delete the directory."""
        playground.delete_dir(path)
        return ""

    yield delete_directory
