# EntryInfo


## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**is_dir** | **bool** |  | 
**name** | **str** |  | 

## Example

```python
from playground_client.models.entry_info import EntryInfo

# TODO update the JSON string below
json = "{}"
# create an instance of EntryInfo from a JSON string
entry_info_instance = EntryInfo.from_json(json)
# print the JSON string representation of the object
print EntryInfo.to_json()

# convert the object into a dict
entry_info_dict = entry_info_instance.to_dict()
# create an instance of EntryInfo from a dict
entry_info_form_dict = entry_info.from_dict(entry_info_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


