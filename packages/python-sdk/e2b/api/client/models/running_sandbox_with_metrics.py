import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.sandbox_metric import SandboxMetric


T = TypeVar("T", bound="RunningSandboxWithMetrics")


@_attrs_define
class RunningSandboxWithMetrics:
    """
    Attributes:
        client_id (str): Identifier of the client
        cpu_count (int): CPU cores for the sandbox
        end_at (datetime.datetime): Time when the sandbox will expire
        memory_mb (int): Memory for the sandbox in MB
        sandbox_id (str): Identifier of the sandbox
        started_at (datetime.datetime): Time when the sandbox was started
        template_id (str): Identifier of the template from which is the sandbox created
        alias (Union[Unset, str]): Alias of the template
        metadata (Union[Unset, Any]):
        metrics (Union[Unset, list['SandboxMetric']]):
    """

    client_id: str
    cpu_count: int
    end_at: datetime.datetime
    memory_mb: int
    sandbox_id: str
    started_at: datetime.datetime
    template_id: str
    alias: Union[Unset, str] = UNSET
    metadata: Union[Unset, Any] = UNSET
    metrics: Union[Unset, list["SandboxMetric"]] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        client_id = self.client_id

        cpu_count = self.cpu_count

        end_at = self.end_at.isoformat()

        memory_mb = self.memory_mb

        sandbox_id = self.sandbox_id

        started_at = self.started_at.isoformat()

        template_id = self.template_id

        alias = self.alias

        metadata = self.metadata

        metrics: Union[Unset, list[dict[str, Any]]] = UNSET
        if not isinstance(self.metrics, Unset):
            metrics = []
            for metrics_item_data in self.metrics:
                metrics_item = metrics_item_data.to_dict()
                metrics.append(metrics_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "clientID": client_id,
                "cpuCount": cpu_count,
                "endAt": end_at,
                "memoryMB": memory_mb,
                "sandboxID": sandbox_id,
                "startedAt": started_at,
                "templateID": template_id,
            }
        )
        if alias is not UNSET:
            field_dict["alias"] = alias
        if metadata is not UNSET:
            field_dict["metadata"] = metadata
        if metrics is not UNSET:
            field_dict["metrics"] = metrics

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sandbox_metric import SandboxMetric

        d = dict(src_dict)
        client_id = d.pop("clientID")

        cpu_count = d.pop("cpuCount")

        end_at = isoparse(d.pop("endAt"))

        memory_mb = d.pop("memoryMB")

        sandbox_id = d.pop("sandboxID")

        started_at = isoparse(d.pop("startedAt"))

        template_id = d.pop("templateID")

        alias = d.pop("alias", UNSET)

        metadata = d.pop("metadata", UNSET)

        metrics = []
        _metrics = d.pop("metrics", UNSET)
        for metrics_item_data in _metrics or []:
            metrics_item = SandboxMetric.from_dict(metrics_item_data)

            metrics.append(metrics_item)

        running_sandbox_with_metrics = cls(
            client_id=client_id,
            cpu_count=cpu_count,
            end_at=end_at,
            memory_mb=memory_mb,
            sandbox_id=sandbox_id,
            started_at=started_at,
            template_id=template_id,
            alias=alias,
            metadata=metadata,
            metrics=metrics,
        )

        running_sandbox_with_metrics.additional_properties = d
        return running_sandbox_with_metrics

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
