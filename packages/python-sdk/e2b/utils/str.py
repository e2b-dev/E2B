import re


def camel_case_to_snake_case(text: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", text).lower()


def snake_case_to_camel_case(text: str) -> str:
    string_split = text.split("_")
    return string_split[0] + "".join(word.capitalize() for word in string_split[1:])
