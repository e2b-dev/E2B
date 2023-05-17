from typing import List
from enum import Enum
from agent.output.output_stream_parser import Step

from agent.output.parse_output import ThoughtLog, ToolLog
from database.client import Client
from session.env import EnvVar


class DeploymentState(Enum):
    Generating = "generating"
    Deploying = "deploying"
    Finished = "finished"
    Error = "error"


TABLE_DEPLOYMENTS = "deployments"
TABLE_PROJECTS = "projects"


class Database:
    def __init__(self, supabase_url: str, supabase_key: str) -> None:
        self.client = Client(supabase_url=supabase_url, supabase_key=supabase_key)

    async def push_logs(self, run_id: str, logs: list[ToolLog | ThoughtLog]) -> None:
        if len(logs) > 0:
            await self.client.table(TABLE_DEPLOYMENTS).update(
                {
                    "logs": logs,
                }
            ).eq("id", run_id).execute()

    async def push_raw_logs(self, run_id: str, logs_raw: str) -> None:
        if logs_raw:
            await self.client.table(TABLE_DEPLOYMENTS).update(
                {
                    "logs_raw": logs_raw,
                }
            ).eq("id", run_id).execute()

    async def upsert_deployment_steps(
        self,
        run_id: str,
        project_id: str,
        steps: List[Step],
    ) -> None:
        await self.client.table(TABLE_DEPLOYMENTS).upsert(
            {
                "id": run_id,
                "logs": steps,
                "project_id": project_id,
            },
            on_conflict="id",
        ).execute()

    async def upsert_deployment_state(
        self,
        run_id: str,
        project_id: str,
        state: DeploymentState,
    ) -> None:
        await self.client.table(TABLE_DEPLOYMENTS).upsert(
            {
                "id": run_id,
                "state": state.value,
                "project_id": project_id,
            },
            on_conflict="id",
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
            await self.client.table(TABLE_PROJECTS)
            .select("data")
            .eq("id", project_id)
            .execute()
        )
        state = result.data[0]["data"]["state"]
        if "envs" in state:
            return state["envs"]
        return []
