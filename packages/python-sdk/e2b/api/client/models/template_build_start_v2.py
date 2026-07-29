from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union

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
        from_image (Union[Unset, str]): Image to use as a base for the template build
        from_template (Union[Unset, str]): Template to use as a base for the template build
        from_image_registry (Union['AWSRegistry', 'GCPRegistry', 'GeneralRegistry', Unset]):
        force (Union[Unset, bool]): Whether the whole build should be forced to run regardless of the cache Default:
            False.
        steps (Union[Unset, list['TemplateStep']]): List of steps to execute in the template build
        start_cmd (Union[Unset, str]): Start command to execute in the template after the build
        ready_cmd (Union[Unset, str]): Ready check command to execute in the template after the build
    """

    from_image: Union[Unset, str] = UNSET
    from_template: Union[Unset, str] = UNSET
    from_image_registry: Union[
        "AWSRegistry", "GCPRegistry", "GeneralRegistry", Unset
    ] = UNSET
    force: Union[Unset, bool] = False
    steps: Union[Unset, list["TemplateStep"]] = UNSET
    start_cmd: Union[Unset, str] = UNSET
    ready_cmd: Union[Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.aws_registry import AWSRegistry
        from ..models.gcp_registry import GCPRegistry

        from_image = self.from_image

        from_template = self.from_template

        from_image_registry: Union[Unset, dict[str, Any]]
        if isinstance(self.from_image_registry, Unset):
            from_image_registry = UNSET
        elif isinstance(self.from_image_registry, AWSRegistry):
            from_image_registry = self.from_image_registry.to_dict()
        elif isinstance(self.from_image_registry, GCPRegistry):
            from_image_registry = self.from_image_registry.to_dict()
        else:
            from_image_registry = self.from_image_registry.to_dict()

        force = self.force

        steps: Union[Unset, list[dict[str, Any]]] = UNSET
        if not isinstance(self.steps, Unset):
            steps = []
            for steps_item_data in self.steps:
                steps_item = steps_item_data.to_dict()
                steps.append(steps_item)

        start_cmd = self.start_cmd

        ready_cmd = self.ready_cmd

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if from_image is not UNSET:
            field_dict["fromImage"] = from_image
        if from_template is not UNSET:
            field_dict["fromTemplate"] = from_template
        if from_image_registry is not UNSET:
            field_dict["fromImageRegistry"] = from_image_registry
        if force is not UNSET:
            field_dict["force"] = force
        if steps is not UNSET:
            field_dict["steps"] = steps
        if start_cmd is not UNSET:
            field_dict["startCmd"] = start_cmd
        if ready_cmd is not UNSET:
            field_dict["readyCmd"] = ready_cmd

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.aws_registry import AWSRegistry
        from ..models.gcp_registry import GCPRegistry
        from ..models.general_registry import GeneralRegistry
        from ..models.template_step import TemplateStep

        d = dict(src_dict)
        from_image = d.pop("fromImage", UNSET)

        from_template = d.pop("fromTemplate", UNSET)

        def _parse_from_image_registry(
            data: object,
        ) -> Union["AWSRegistry", "GCPRegistry", "GeneralRegistry", Unset]:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_from_image_registry_type_0 = AWSRegistry.from_dict(
                    data
                )

                return componentsschemas_from_image_registry_type_0
            except:  # noqa: E722
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_from_image_registry_type_1 = GCPRegistry.from_dict(
                    data
                )

                return componentsschemas_from_image_registry_type_1
            except:  # noqa: E722
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

        force = d.pop("force", UNSET)

        steps = []
        _steps = d.pop("steps", UNSET)
        for steps_item_data in _steps or []:
            steps_item = TemplateStep.from_dict(steps_item_data)

            steps.append(steps_item)

        start_cmd = d.pop("startCmd", UNSET)

        ready_cmd = d.pop("readyCmd", UNSET)

        template_build_start_v2 = cls(
            from_image=from_image,
            from_template=from_template,
            from_image_registry=from_image_registry,
            force=force,
            steps=steps,
            start_cmd=start_cmd,
            ready_cmd=ready_cmd,
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
