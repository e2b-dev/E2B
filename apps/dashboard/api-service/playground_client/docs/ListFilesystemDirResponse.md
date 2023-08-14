# ListFilesystemDirResponse


## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**entries** | [**List[EntryInfo]**](EntryInfo.md) |  | 

## Example

```python
from playground_client.models.list_filesystem_dir_response import ListFilesystemDirResponse

# TODO update the JSON string below
json = "{}"
# create an instance of ListFilesystemDirResponse from a JSON string
list_filesystem_dir_response_instance = ListFilesystemDirResponse.from_json(json)
# print the JSON string representation of the object
print ListFilesystemDirResponse.to_json()

# convert the object into a dict
list_filesystem_dir_response_dict = list_filesystem_dir_response_instance.to_dict()
# create an instance of ListFilesystemDirResponse from a dict
list_filesystem_dir_response_form_dict = list_filesystem_dir_response.from_dict(list_filesystem_dir_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


