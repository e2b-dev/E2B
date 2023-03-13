# CreateMockDataRequest


## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**files** | [**List[File]**](File.md) |  | 
**target_interface** | **str** |  | 

## Example

```python
from playground_client.models.create_mock_data_request import CreateMockDataRequest

# TODO update the JSON string below
json = "{}"
# create an instance of CreateMockDataRequest from a JSON string
create_mock_data_request_instance = CreateMockDataRequest.from_json(json)
# print the JSON string representation of the object
print CreateMockDataRequest.to_json()

# convert the object into a dict
create_mock_data_request_dict = create_mock_data_request_instance.to_dict()
# create an instance of CreateMockDataRequest from a dict
create_mock_data_request_form_dict = create_mock_data_request.from_dict(create_mock_data_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


