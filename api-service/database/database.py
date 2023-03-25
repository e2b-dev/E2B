from typing import List
from enum import Enum

from codegen.agent.parsing import ThoughtLog, ToolLog
from database.client import Client
from session.env import EnvVar


class DeploymentState(Enum):
    Generating = "generating"
    Deploying = "deploying"
    Finished = "finished"
    Error = "error"


tableDeployments = "deployments"
tableProjects = "projects"

class Database:
    def __init__(self, supabase_url: str, supabase_key: str) -> None:
        self.client = Client(supabase_url=supabase_url, supabase_key=supabase_key)

    async def create_deployment(
        self, run_id: str, project_id: str, route_id: str
    ) -> None:
        await self.client.table(tableDeployments).insert(
            {
                "id": run_id,
                "project_id": project_id,
                "route_id": route_id,
                "state": DeploymentState.Generating.value,
            },
        ).execute()

    async def push_logs(self, run_id: str, logs: list[ToolLog | ThoughtLog]) -> None:
        if len(logs) > 0:
            await self.client.table(tableDeployments).update(
                {
                    "logs": logs,
                }
            ).eq("id", run_id).execute()

    async def push_raw_logs(self, run_id: str, logs_raw: str) -> None:
        if logs_raw:
            await self.client.table(tableDeployments).update(
                {
                    "logs_raw": logs_raw,
                }
            ).eq("id", run_id).execute()

    async def update_state(self, run_id: str, state: DeploymentState) -> None:
        await self.client.table(tableDeployments).update(
            {
                "state": state.value,
            }
        ).eq("id", run_id).execute()

    async def finish_deployment(self, run_id: str, url: str | None) -> None:
        update = {
            "url": url,
            "state": DeploymentState.Finished.value,
        }

        if url is not None:
            update["url"] = url

        await self.client.table(tableDeployments).update(update).eq(
            "id", run_id
        ).execute()

    async def get_env_vars(self, project_id: str) -> List[EnvVar]:
        """The return value is a list of dicts with the following keys:
        - key: The name of an env var
        - value: The value of an env var

        Example of a return value:
        [
            {
                "key": "",
                "value": "",
            },
            {
                "key": "MY_TOKEN",
                "value": "my-token-value",
            }
        ]
        """
        result = (
            await self.client.table(tableProjects)
            .select("data")
            .eq("id", project_id)
            .execute()
        )
        state = result.data[0]["data"]["state"]
        if "envs" in state:
            return state["envs"]
        return []
