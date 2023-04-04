import xml.etree.ElementTree as ET
import re
from typing_extensions import NotRequired
from typing import TypedDict
from typing import Literal
from lxml import etree

escape_table = str.maketrans({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
})

def xml_escape(text: str):
    return text.translate(escape_table)


class Log(TypedDict):
    id: NotRequired[str]
    type: Literal["thought"] | Literal["tool"]
    created_at: NotRequired[str]

class ThoughtLog(Log):
    content: str

class ToolLog(Log):
    tool_name: str
    tool_input: str
    tool_output: NotRequired[str]
    finish_at: NotRequired[str]

def merge_logs(log: TypedDict, other: TypedDict):
    log.update(other)


action_tag_open = "<action(\\s+tool=\".+?\")?\\s*/?>?"
action_tag_close = "</\\s*action\\s*>?"

action_tag_split_pattern = re.compile(f"({action_tag_open})|({action_tag_close})|(.+?)")
action_tag_check_pattern = re.compile(f"{action_tag_open}|{action_tag_close}")

def parse_thoughts_and_actions(text: str):
    escaped = "".join(
        # If the text part is not action tag escape it.
        part if action_tag_check_pattern.match(part) else xml_escape(part)
        for part
        # Split the text by action opening and closing tags.
        in re.split(action_tag_split_pattern, text)
        if part
    )

    root = ET.fromstring(
        f"<root>{escaped}</root>",
        # Use Parser with C binding for libxml2+libxslt, with recovery mode that allows to parse incomplete XML.
        etree.XMLParser(recover=True),
    )

    leading_thought = root.text.strip() if root.text else None
    if leading_thought:
        yield ThoughtLog(type="thought", content=leading_thought)

    for action in root.findall("action"):
        tool_name = action.attrib.get("tool", "")
        if tool_name:
            yield ToolLog(type="tool", tool_name=tool_name, tool_input=action.text or "")

        # Create thoughts from text between and after actions.
        trailing_thought = action.tail.strip() if action.tail else None
        if trailing_thought:
            yield ThoughtLog(type="thought", content=trailing_thought)
