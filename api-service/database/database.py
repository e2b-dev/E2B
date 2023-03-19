from typing import List, Dict
from enum import Enum
from supabase import create_client


class DeploymentState(Enum):
    Generating = "generating"
    Deploying = "deploying"
    Finished = "finished"
    Error = "error"


deploymentsTable = "deployments"


class Database:
    def __init__(self, url: str, key: str):
        self.client = create_client(url, key)

    def create_deployment(self, run_id: str, project_id: str, route_id: str) -> None:
        self.client.table(deploymentsTable).insert(
            {
                "id": run_id,
                "project_id": project_id,
                "route_id": route_id,
                "state": DeploymentState.Generating.value,
            },
        ).execute()

    def push_logs(self, run_id: str, logs: List[Dict[str, str]]) -> None:
        if len(logs) > 0:
            self.client.table(deploymentsTable).update(
                {
                    "logs": logs,
                }
            ).eq("id", run_id).execute()

    def push_raw_logs(self, run_id: str, logs_raw: str) -> None:
        if logs_raw:
            self.client.table(deploymentsTable).update(
                {
                    "logs_raw": logs_raw,
                }
            ).eq("id", run_id).execute()

    def update_state(self, run_id: str, state: DeploymentState) -> None:
        self.client.table(deploymentsTable).update(
            {
                "state": state.value,
            }
        ).eq("id", run_id).execute()

    def update_url(self, run_id: str, url: str) -> None:
        self.client.table(deploymentsTable).update(
            {
                "url": url,
            }
        ).eq("id", run_id).execute()
