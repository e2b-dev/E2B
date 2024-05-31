# coding: utf-8

"""
    E2B API

    No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)

    The version of the OpenAPI document: 0.1.0
    Generated by OpenAPI Generator (https://openapi-generator.tech)

    Do not edit the class manually.
"""  # noqa: E501


from __future__ import annotations
import pprint
import re  # noqa: F401
import json


from typing import Any, Dict, Optional
from pydantic import BaseModel, Field, StrictStr, conint


class NewSandbox(BaseModel):
    """
    NewSandbox
    """

    template_id: StrictStr = Field(
        ..., alias="templateID", description="Identifier of the required template"
    )
    timeout: Optional[conint(strict=True, ge=0)] = Field(
        None, description="Time to live for the sandbox in seconds."
    )
    metadata: Optional[Dict[str, StrictStr]] = None
    additional_properties: Dict[str, Any] = {}
    __properties = ["templateID", "timeout", "metadata"]

    class Config:
        """Pydantic configuration"""

        allow_population_by_field_name = True
        validate_assignment = True

    def to_str(self) -> str:
        """Returns the string representation of the model using alias"""
        return pprint.pformat(self.dict(by_alias=True))

    def to_json(self) -> str:
        """Returns the JSON representation of the model using alias"""
        return json.dumps(self.to_dict())

    @classmethod
    def from_json(cls, json_str: str) -> NewSandbox:
        """Create an instance of NewSandbox from a JSON string"""
        return cls.from_dict(json.loads(json_str))

    def to_dict(self):
        """Returns the dictionary representation of the model using alias"""
        _dict = self.dict(
            by_alias=True, exclude={"additional_properties"}, exclude_none=True
        )
        # puts key-value pairs in additional_properties in the top level
        if self.additional_properties is not None:
            for _key, _value in self.additional_properties.items():
                _dict[_key] = _value

        return _dict

    @classmethod
    def from_dict(cls, obj: dict) -> NewSandbox:
        """Create an instance of NewSandbox from a dict"""
        if obj is None:
            return None

        if not isinstance(obj, dict):
            return NewSandbox.parse_obj(obj)

        _obj = NewSandbox.parse_obj(
            {
                "template_id": obj.get("templateID"),
                "timeout": obj.get("timeout"),
                "metadata": obj.get("metadata"),
            }
        )
        # store additional fields in additional_properties
        for _key in obj.keys():
            if _key not in cls.__properties:
                _obj.additional_properties[_key] = obj.get(_key)

        return _obj
