from typing import Any, Dict

from opentelemetry.metrics import Observation
from database.base import db
from deployment.manager import AgentDeploymentManager, AgentDeployment
from agent.from_template import get_agent_factory_from_template
from observability import meter


# TODO: Interemediate step between implementing the FC agent deployment
# can be improving the in-memory deployment manager to use the processes instead of threads.
class InMemoryDeploymentManager(AgentDeploymentManager):
    def __init__(self):
        self._deployments: Dict[str, AgentDeployment] = {}

        def report_deployments(opts):
            yield Observation(value=len(self._deployments))

        self.active_deployments_counter = meter.create_observable_up_down_counter(
            "agents.deployments.active",
            [report_deployments],
            "1",
            "Current number of active agent deployments",
        )

        def report_running_deployments(opts):
            yield Observation(
                value=len(
                    [
                        deployment
                        for deployment in self._deployments.values()
                        if deployment.agent.is_running()
                    ]
                )
            )

        self.active_deployment_runs_counter = meter.create_observable_up_down_counter(
            "agents.deployments.runs.active",
            [report_running_deployments],
            "1",
            "Current number of active agent deployment runs",
        )

    async def create_deployment(
        self,
        id: str,
        project_id: str,
        config: Any,
        secrets: Any,
    ):
        print("Creating deployment", config)
        deployment = await AgentDeployment.from_factory(
            id,
            get_agent_factory_from_template(config["templateID"]),
            project_id,
            {
                **config,
                **secrets,
            },
        )
        try:
            # Right now we are not overwriting secrets here because
            # there is some problem with encrypting them when calling Supabase from the Python client and the JSON saved is invalid.
            await db.create_deployment(deployment.id, project_id, config)
        except:
            await deployment.agent.stop()
            raise

        self._deployments[deployment.id] = deployment
        return deployment

    async def update_deployment(
        self,
        id: str,
        project_id: str,
        config: Any,
        secrets: Any,
    ):
        print(">>>> Updating deployment", id, config)
        try:
            await self.remove_deployment(id)
        except:
            print("Failed to remove deployment", id)
            pass
        return await self.create_deployment(
            id,
            project_id,
            config,
            secrets,
        )

    async def remove_deployment(self, id: str):
        deployment = await self.get_deployment(id)
        await db.update_deployment(id, enabled=False)
        if deployment:
            await deployment.agent.stop()
            del self._deployments[deployment.id]

    async def get_deployment(self, id: str):
        return self._deployments.get(id, None)

    async def list_deployments(self) -> list[AgentDeployment]:
        return list(self._deployments.values())
