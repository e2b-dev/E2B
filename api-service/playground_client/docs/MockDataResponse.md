# MockDataResponse


## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**mock_data** | [**MockDataResponseMockData**](MockDataResponseMockData.md) |  | 

## Example

```python
from playground_client.models.mock_data_response import MockDataResponse

# TODO update the JSON string below
json = "{}"
# create an instance of MockDataResponse from a JSON string
mock_data_response_instance = MockDataResponse.from_json(json)
# print the JSON string representation of the object
print MockDataResponse.to_json()

# convert the object into a dict
mock_data_response_dict = mock_data_response_instance.to_dict()
# create an instance of MockDataResponse from a dict
mock_data_response_form_dict = mock_data_response.from_dict(mock_data_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


