# OpenPort


## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**state** | **str** |  | 
**ip** | **str** |  | 
**port** | **float** |  | 

## Example

```python
from playground_client.models.open_port import OpenPort

# TODO update the JSON string below
json = "{}"
# create an instance of OpenPort from a JSON string
open_port_instance = OpenPort.from_json(json)
# print the JSON string representation of the object
print OpenPort.to_json()

# convert the object into a dict
open_port_dict = open_port_instance.to_dict()
# create an instance of OpenPort from a dict
open_port_form_dict = open_port.from_dict(open_port_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


