from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.aws_registry import AWSRegistry
    from ..models.gcp_registry import GCPRegistry
    from ..models.general_registry import GeneralRegistry
    from ..models.template_step import TemplateStep


T = TypeVar("T", bound="TemplateBuildStartV2")


@_attrs_define
class TemplateBuildStartV2:
    """
    Attributes:
        force (bool | Unset): Whether the whole build should be forced to run regardless of the cache Default: False.
        from_image (str | Unset): Image to use as a base for the template build
        from_image_registry (AWSRegistry | GCPRegistry | GeneralRegistry | Unset):
        from_template (str | Unset): Template to use as a base for the template build
        ready_cmd (str | Unset): Ready check command to execute in the template after the build
        start_cmd (str | Unset): Start command to execute in the template after the build
        steps (list[TemplateStep] | Unset): List of steps to execute in the template build
    """

    force: bool | Unset = False
    from_image: str | Unset = UNSET
    from_image_registry: AWSRegistry | GCPRegistry | GeneralRegistry | Unset = UNSET
    from_template: str | Unset = UNSET
    ready_cmd: str | Unset = UNSET
    start_cmd: str | Unset = UNSET
    steps: list[TemplateStep] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.aws_registry import AWSRegistry
        from ..models.gcp_registry import GCPRegistry

        force = self.force

        from_image = self.from_image

        from_image_registry: dict[str, Any] | Unset
        if isinstance(self.from_image_registry, Unset):
            from_image_registry = UNSET
        elif isinstance(self.from_image_registry, AWSRegistry):
            from_image_registry = self.from_image_registry.to_dict()
        elif isinstance(self.from_image_registry, GCPRegistry):
            from_image_registry = self.from_image_registry.to_dict()
        else:
            from_image_registry = self.from_image_registry.to_dict()

        from_template = self.from_template

        ready_cmd = self.ready_cmd

        start_cmd = self.start_cmd

        steps: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.steps, Unset):
            steps = []
            for steps_item_data in self.steps:
                steps_item = steps_item_data.to_dict()
                steps.append(steps_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if force is not UNSET:
            field_dict["force"] = force
        if from_image is not UNSET:
            field_dict["fromImage"] = from_image
        if from_image_registry is not UNSET:
            field_dict["fromImageRegistry"] = from_image_registry
        if from_template is not UNSET:
            field_dict["fromTemplate"] = from_template
        if ready_cmd is not UNSET:
            field_dict["readyCmd"] = ready_cmd
        if start_cmd is not UNSET:
            field_dict["startCmd"] = start_cmd
        if steps is not UNSET:
            field_dict["steps"] = steps

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.aws_registry import AWSRegistry
        from ..models.gcp_registry import GCPRegistry
        from ..models.general_registry import GeneralRegistry
        from ..models.template_step import TemplateStep

        d = dict(src_dict)
        force = d.pop("force", UNSET)

        from_image = d.pop("fromImage", UNSET)

        def _parse_from_image_registry(
            data: object,
        ) -> AWSRegistry | GCPRegistry | GeneralRegistry | Unset:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_from_image_registry_type_0 = AWSRegistry.from_dict(
                    data
                )

                return componentsschemas_from_image_registry_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_from_image_registry_type_1 = GCPRegistry.from_dict(
                    data
                )

                return componentsschemas_from_image_registry_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_from_image_registry_type_2 = GeneralRegistry.from_dict(
                data
            )

            return componentsschemas_from_image_registry_type_2

        from_image_registry = _parse_from_image_registry(
            d.pop("fromImageRegistry", UNSET)
        )

        from_template = d.pop("fromTemplate", UNSET)

        ready_cmd = d.pop("readyCmd", UNSET)

        start_cmd = d.pop("startCmd", UNSET)

        _steps = d.pop("steps", UNSET)
        steps: list[TemplateStep] | Unset = UNSET
        if _steps is not UNSET:
            steps = []
            for steps_item_data in _steps:
                steps_item = TemplateStep.from_dict(steps_item_data)

                steps.append(steps_item)

        template_build_start_v2 = cls(
            force=force,
            from_image=from_image,
            from_image_registry=from_image_registry,
            from_template=from_template,
            ready_cmd=ready_cmd,
            start_cmd=start_cmd,
            steps=steps,
        )

        template_build_start_v2.additional_properties = d
        return template_build_start_v2

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
