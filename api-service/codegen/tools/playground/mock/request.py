from enum import Enum
import json

import typing as t

JSON = t.Union[str, int, float, bool, None, t.Mapping[str, "JSON"], t.List["JSON"]]


class MockRequestFactory:
    def __init__(
        self,
        method: str,
        route: str,
        body_template: str,
        hostname: str = "http://localhost:3000",
    ) -> None:
        self.hostname = hostname
        self.method = method.upper()
        self.route = route
        self.body_template = body_template

    def terminal_command(self) -> str:
        body = self.generate_body_data()
        return f"curl -X {self.method} {self.hostname}/{self.route} -H 'Content-Type: application/json' -d {json.dumps(body)}"

    def generate_body_data(self) -> JSON:
        self.body_template
        # request_body_template = f"""interface RequestBody {{
        #     {body_template}
        # }}
        # """
        # https://github.com/joke2k/faker
        # https://github.com/faker-js/faker
        # https://github.com/google/intermock
        pass
