from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.sidecar_attachment_config import SidecarAttachmentConfig
    from ..models.sidecar_attachment_secrets import SidecarAttachmentSecrets


T = TypeVar("T", bound="SidecarAttachment")


@_attrs_define
class SidecarAttachment:
    """A sidecar microVM to attach to the sandbox, declared from the E2B sidecar catalog.

    Attributes:
        entry (str): Catalog entry name (for example "iron-proxy" or "redis"). The sandbox reaches the sidecar at
            "{entry}.sidecar.e2b.local".
        version (Union[Unset, str]): Catalog entry version. Defaults to the entry's current version.
        config (Union[Unset, SidecarAttachmentConfig]): Entry-specific configuration, validated against the entry's
            schema. String values may reference secrets as "${e2b.secrets.<name>}".
        secrets (Union[Unset, SidecarAttachmentSecrets]): Secret slots the entry declares, keyed by slot name, each
            holding a secret reference the platform resolves at injection time. The secret value never enters the sandbox.
    """

    entry: str
    version: Union[Unset, str] = UNSET
    config: Union[Unset, "SidecarAttachmentConfig"] = UNSET
    secrets: Union[Unset, "SidecarAttachmentSecrets"] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        entry = self.entry

        version = self.version

        config: Union[Unset, dict[str, Any]] = UNSET
        if not isinstance(self.config, Unset):
            config = self.config.to_dict()

        secrets: Union[Unset, dict[str, Any]] = UNSET
        if not isinstance(self.secrets, Unset):
            secrets = self.secrets.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "entry": entry,
            }
        )
        if version is not UNSET:
            field_dict["version"] = version
        if config is not UNSET:
            field_dict["config"] = config
        if secrets is not UNSET:
            field_dict["secrets"] = secrets

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sidecar_attachment_config import SidecarAttachmentConfig
        from ..models.sidecar_attachment_secrets import SidecarAttachmentSecrets

        d = dict(src_dict)
        entry = d.pop("entry")

        version = d.pop("version", UNSET)

        _config = d.pop("config", UNSET)
        config: Union[Unset, SidecarAttachmentConfig]
        if isinstance(_config, Unset):
            config = UNSET
        else:
            config = SidecarAttachmentConfig.from_dict(_config)

        _secrets = d.pop("secrets", UNSET)
        secrets: Union[Unset, SidecarAttachmentSecrets]
        if isinstance(_secrets, Unset):
            secrets = UNSET
        else:
            secrets = SidecarAttachmentSecrets.from_dict(_secrets)

        sidecar_attachment = cls(
            entry=entry,
            version=version,
            config=config,
            secrets=secrets,
        )

        sidecar_attachment.additional_properties = d
        return sidecar_attachment

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
