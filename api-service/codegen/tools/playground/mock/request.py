from enum import Enum
import json

import typing as t
from codegen.tools import playground

from codegen.tools.playground.playground import Playground
JSON = t.Union[str, int, float, bool, None, t.Mapping[str, "JSON"], t.List["JSON"]]


class MockRequestFactory:
    def __init__(
        self,
        method: str,
        route: str,
        body_template: str,
        playground: Playground,
        hostname: str = "http://localhost:3000",
    ) -> None:
        self.hostname = hostname
        self.method = method.upper()
        self.route = route
        self.body_template = body_template
        self.playground = playground

    def terminal_command(self) -> str:
        body = self.generate_body_data()
        return f"curl -X {self.method} {self.hostname}/{self.route} -H 'Content-Type: application/json' -d {json.dumps(body)}"

    def generate_body_data(self) -> JSON:
        body_interface_name = "RequestBody"
        request_body_template = f"""interface {body_interface_name} {{
            {self.body_template}
        }}
        """

        self.playground.api.



        # https://github.com/joke2k/faker
        # https://github.com/faker-js/faker
        # https://github.com/google/intermock
        pass
