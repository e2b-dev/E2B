import json
from codegen.tools.playground.playground import Playground

# https://github.com/joke2k/faker
# https://github.com/faker-js/faker
# https://github.com/google/intermock

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
        route_separator = "/" if len(self.route) > 0 and not self.route == "/" else ""
        return f"curl -X {self.method} {self.hostname}{route_separator}{self.route} -H 'Content-Type: application/json' -d {json.dumps(body)}"

    def generate_body_data(self):
        body_interface_name = "RequestBody"
        request_body_template = f"""interface {body_interface_name} {{
            {self.body_template}
        }}
        """
        body = json.loads(self.playground.mock_body_data(request_body_template, body_interface_name))[body_interface_name]
        return json.dumps(body)
