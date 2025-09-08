from typing import Union
import json


class GenericDockerRegistry:
    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password

    def to_dict(self):
        return {
            "type": "registry",
            "username": self.username,
            "password": self.password,
        }


class AWSRegistry:
    def __init__(
        self, aws_access_key_id: str, aws_secret_access_key: str, aws_region: str
    ):
        self.aws_access_key_id = aws_access_key_id
        self.aws_secret_access_key = aws_secret_access_key
        self.aws_region = aws_region

    def to_dict(self):
        return {
            "type": "aws",
            "aws_access_key_id": self.aws_access_key_id,
            "aws_secret_access_key": self.aws_secret_access_key,
            "aws_region": self.aws_region,
        }


class GCPRegistry:
    def __init__(self, service_account_json: Union[str, dict]):
        self.service_account_json = service_account_json

    def to_dict(self):
        return {
            "type": "gcp",
            "service_account_json": (
                self.service_account_json
                if isinstance(self.service_account_json, str)
                else json.dumps(self.service_account_json)
            ),
        }


RegistryConfig = Union[GenericDockerRegistry, AWSRegistry, GCPRegistry]
