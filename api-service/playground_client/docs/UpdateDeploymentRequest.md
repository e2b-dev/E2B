# UpdateDeploymentRequest


## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**env_vars** | **Dict[str, str]** |  | [optional] 
**code** | **str** |  | [optional] 

## Example

```python
from playground_client.models.update_deployment_request import UpdateDeploymentRequest

# TODO update the JSON string below
json = "{}"
# create an instance of UpdateDeploymentRequest from a JSON string
update_deployment_request_instance = UpdateDeploymentRequest.from_json(json)
# print the JSON string representation of the object
print UpdateDeploymentRequest.to_json()

# convert the object into a dict
update_deployment_request_dict = update_deployment_request_instance.to_dict()
# create an instance of UpdateDeploymentRequest from a dict
update_deployment_request_form_dict = update_deployment_request.from_dict(update_deployment_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


