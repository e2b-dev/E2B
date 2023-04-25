from codegen.callbacks.log_processor import LogProcessor
from codegen.callbacks.logs import OnLogs
from codegen.codegen import Codegen
from codegen.tools.base import create_tools
from database.database import DeploymentState
from models.base import ModelConfig
from database import db
from session import NodeJSPlayground


async def run_agent(
    project_id: str,
    run_id: str,
    model_config: ModelConfig,
    log_processor: LogProcessor,
):
    await db.create_deployment(run_id=run_id, project_id=project_id)
    playground = None

    try:
        # Create playground for the LLM
        playground = NodeJSPlayground(get_envs=lambda: db.get_env_vars(project_id))

        # Create tools
        tools = create_tools(
            run_id=run_id,
            playground=playground,
        )

        # Create a new instance of code generator
        cg = Codegen(
            log_processor=log_processor,
            # The order in which we pass tools HAS an effect on the LLM behaviour.
            tools=list(tools),
            model_config=model_config,
            database=db,
        )

        # Generate the code
        print("Generating...", flush=True)
        await cg.generate(run_id=run_id)

        await db.finish_deployment(run_id=run_id)
    except:
        await db.update_state(run_id=run_id, state=DeploymentState.Error)
        raise
    finally:
        if playground is not None:
            playground.close()
