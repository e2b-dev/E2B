# CreateSessionsRequest


## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**env_id** | **str** |  | 

## Example

```python
from playground_client.models.create_sessions_request import CreateSessionsRequest

# TODO update the JSON string below
json = "{}"
# create an instance of CreateSessionsRequest from a JSON string
create_sessions_request_instance = CreateSessionsRequest.from_json(json)
# print the JSON string representation of the object
print CreateSessionsRequest.to_json()

# convert the object into a dict
create_sessions_request_dict = create_sessions_request_instance.to_dict()
# create an instance of CreateSessionsRequest from a dict
create_sessions_request_form_dict = create_sessions_request.from_dict(create_sessions_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


