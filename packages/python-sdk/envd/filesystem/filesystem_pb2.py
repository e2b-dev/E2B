# -*- coding: utf-8 -*-
# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: envd/filesystem/filesystem.proto
# Protobuf Python Version: 5.26.1
"""Generated protocol buffer code."""
from google.protobuf import descriptor as _descriptor
from google.protobuf import descriptor_pool as _descriptor_pool
from google.protobuf import symbol_database as _symbol_database
from google.protobuf.internal import builder as _builder
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()


from envd.permissions import permissions_pb2 as envd_dot_permissions_dot_permissions__pb2


DESCRIPTOR = _descriptor_pool.Default().AddSerializedFile(b'\n envd/filesystem/filesystem.proto\x12\x0f\x65nvd.filesystem\x1a\"envd/permissions/permissions.proto\"O\n\rRemoveRequest\x12\x12\n\x04path\x18\x01 \x01(\tR\x04path\x12*\n\x04user\x18\x02 \x01(\x0b\x32\x16.envd.permissions.UserR\x04user\"\x10\n\x0eRemoveResponse\"M\n\x0bStatRequest\x12\x12\n\x04path\x18\x01 \x01(\tR\x04path\x12*\n\x04user\x18\x02 \x01(\x0b\x32\x16.envd.permissions.UserR\x04user\"@\n\x0cStatResponse\x12\x30\n\x05\x65ntry\x18\x01 \x01(\x0b\x32\x1a.envd.filesystem.EntryInfoR\x05\x65ntry\"N\n\tEntryInfo\x12\x12\n\x04name\x18\x01 \x01(\tR\x04name\x12-\n\x04type\x18\x02 \x01(\x0e\x32\x19.envd.filesystem.FileTypeR\x04type\"M\n\x0bListRequest\x12\x12\n\x04path\x18\x01 \x01(\tR\x04path\x12*\n\x04user\x18\x02 \x01(\x0b\x32\x16.envd.permissions.UserR\x04user\"D\n\x0cListResponse\x12\x34\n\x07\x65ntries\x18\x01 \x03(\x0b\x32\x1a.envd.filesystem.EntryInfoR\x07\x65ntries\"N\n\x0cWatchRequest\x12\x12\n\x04path\x18\x01 \x01(\tR\x04path\x12*\n\x04user\x18\x02 \x01(\x0b\x32\x16.envd.permissions.UserR\x04user\"G\n\rWatchResponse\x12\x36\n\x05\x65vent\x18\x01 \x01(\x0b\x32 .envd.filesystem.FilesystemEventR\x05\x65vent\"U\n\x0f\x46ilesystemEvent\x12\x12\n\x04path\x18\x01 \x01(\tR\x04path\x12.\n\x04type\x18\x02 \x01(\x0e\x32\x1a.envd.filesystem.EventTypeR\x04type*R\n\x08\x46ileType\x12\x19\n\x15\x46ILE_TYPE_UNSPECIFIED\x10\x00\x12\x12\n\x0e\x46ILE_TYPE_FILE\x10\x01\x12\x17\n\x13\x46ILE_TYPE_DIRECTORY\x10\x02*\x98\x01\n\tEventType\x12\x1a\n\x16\x45VENT_TYPE_UNSPECIFIED\x10\x00\x12\x15\n\x11\x45VENT_TYPE_CREATE\x10\x01\x12\x14\n\x10\x45VENT_TYPE_WRITE\x10\x02\x12\x15\n\x11\x45VENT_TYPE_REMOVE\x10\x03\x12\x15\n\x11\x45VENT_TYPE_RENAME\x10\x04\x12\x14\n\x10\x45VENT_TYPE_CHMOD\x10\x05\x32\xb2\x02\n\x11\x46ilesystemService\x12\x43\n\x04Stat\x12\x1c.envd.filesystem.StatRequest\x1a\x1d.envd.filesystem.StatResponse\x12\x43\n\x04List\x12\x1c.envd.filesystem.ListRequest\x1a\x1d.envd.filesystem.ListResponse\x12H\n\x05Watch\x12\x1d.envd.filesystem.WatchRequest\x1a\x1e.envd.filesystem.WatchResponse0\x01\x12I\n\x06Remove\x12\x1e.envd.filesystem.RemoveRequest\x1a\x1f.envd.filesystem.RemoveResponseB\x83\x01\n\x13\x63om.envd.filesystemB\x0f\x46ilesystemProtoP\x01\xa2\x02\x03\x45\x46X\xaa\x02\x0f\x45nvd.Filesystem\xca\x02\x0f\x45nvd\\Filesystem\xe2\x02\x1b\x45nvd\\Filesystem\\GPBMetadata\xea\x02\x10\x45nvd::Filesystemb\x06proto3')

_globals = globals()
_builder.BuildMessageAndEnumDescriptors(DESCRIPTOR, _globals)
_builder.BuildTopDescriptorsAndMessages(DESCRIPTOR, 'envd.filesystem.filesystem_pb2', _globals)
if not _descriptor._USE_C_DESCRIPTORS:
  _globals['DESCRIPTOR']._loaded_options = None
  _globals['DESCRIPTOR']._serialized_options = b'\n\023com.envd.filesystemB\017FilesystemProtoP\001\242\002\003EFX\252\002\017Envd.Filesystem\312\002\017Envd\\Filesystem\342\002\033Envd\\Filesystem\\GPBMetadata\352\002\020Envd::Filesystem'
  _globals['_FILETYPE']._serialized_start=802
  _globals['_FILETYPE']._serialized_end=884
  _globals['_EVENTTYPE']._serialized_start=887
  _globals['_EVENTTYPE']._serialized_end=1039
  _globals['_REMOVEREQUEST']._serialized_start=89
  _globals['_REMOVEREQUEST']._serialized_end=168
  _globals['_REMOVERESPONSE']._serialized_start=170
  _globals['_REMOVERESPONSE']._serialized_end=186
  _globals['_STATREQUEST']._serialized_start=188
  _globals['_STATREQUEST']._serialized_end=265
  _globals['_STATRESPONSE']._serialized_start=267
  _globals['_STATRESPONSE']._serialized_end=331
  _globals['_ENTRYINFO']._serialized_start=333
  _globals['_ENTRYINFO']._serialized_end=411
  _globals['_LISTREQUEST']._serialized_start=413
  _globals['_LISTREQUEST']._serialized_end=490
  _globals['_LISTRESPONSE']._serialized_start=492
  _globals['_LISTRESPONSE']._serialized_end=560
  _globals['_WATCHREQUEST']._serialized_start=562
  _globals['_WATCHREQUEST']._serialized_end=640
  _globals['_WATCHRESPONSE']._serialized_start=642
  _globals['_WATCHRESPONSE']._serialized_end=713
  _globals['_FILESYSTEMEVENT']._serialized_start=715
  _globals['_FILESYSTEMEVENT']._serialized_end=800
  _globals['_FILESYSTEMSERVICE']._serialized_start=1042
  _globals['_FILESYSTEMSERVICE']._serialized_end=1348
# @@protoc_insertion_point(module_scope)