import asyncio
import uuid
import os
import ast
from decimal import Decimal

from langchain.chat_models import ChatOpenAI
from langchain.schema import BaseLanguageModel
from typing import Any, Callable, List
from langchain.callbacks.base import AsyncCallbackManager
from langchain.schema import (
    AIMessage,
    BaseLanguageModel,
    BaseMessage,
    SystemMessage,
    HumanMessage,
)
from langchain.prompts.chat import (
    ChatPromptValue,
)
from opentelemetry.trace.span import StatusCode, Status

from observability import tracer
from agent.base import (
    AgentInteraction,
    OnLogs,
    OnInteractionRequest,
)
from agent.base import AgentBase, AgentInteractionRequest, GetEnvs
from session.playground import Playground

default_openai_api_key = os.environ.get("OPENAI_API_KEY", None)
default_openai_model = "gpt-4"
# Pricing is in USD per token
models = {
    "gpt-4": {
        "prompt": Decimal(0.00003),
        "completion": Decimal(0.00006),
        "max_tokens": 8192,
    },
    "gpt-4-1106-preview": {
        "prompt": Decimal(0.00001),
        "completion": Decimal(0.00003),
        "max_tokens": 8192,
    },
    "gpt-4-32k": {
        "prompt": Decimal(0.00006),
        "completion": Decimal(0.00012),
        "max_tokens": 32768,
    },
    "gpt-3.5-turbo": {
        "prompt": Decimal(0.000001),
        "completion": Decimal(0.000002),
        "max_tokens": 16384,
    },
    "gpt-3.5-turbo-16k": {
        "prompt": Decimal(0.000003),
        "completion": Decimal(0.000004),
        "max_tokens": 16384,
    },
}

extensions_to_skip = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp",
    ".svg",
    ".ico",
    ".tif",
    ".raw",
    ".webp",
    ".tiff",
    ".mp3",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "Gemfile.lock",
    "Pipfile.lock",
    "composer.lock",
    "Cargo.lock",
    "pubspec.lock",
    "packages.lock.json",
    "go.sum",
    "Package.resolved",
]


# Helper function for limiting number of concurrent coroutines
async def with_semaphore(semaphore, coro):
    async with semaphore:
        return await coro


class SmolAgent(AgentBase):
    max_run_time = 2 * 60 * 60  # 2 hours in seconds

    def __init__(
        self,
        config: Any,
        get_envs: GetEnvs,
        set_run_id: Callable[[str], None],
        on_logs: OnLogs,
        on_interaction_request: OnInteractionRequest,
        model: BaseLanguageModel,
        model_name: str,
        e2b_api_key: str,
    ):
        super().__init__()
        self._dev_loop: asyncio.Task | None = None
        self.get_envs = get_envs
        self.config = config
        self.model_name = model_name
        self.on_interaction_request = on_interaction_request
        self.on_logs = on_logs
        self.set_run_id = set_run_id
        self.model = model
        self.e2b_api_key = e2b_api_key

    @classmethod
    async def create(
        cls,
        config: Any,
        get_envs: GetEnvs,
        set_run_id: Callable[[str], None],
        on_logs: OnLogs,
        on_interaction_request: OnInteractionRequest,
        e2b_api_key: str,
    ):
        callback_manager = AsyncCallbackManager([])
        model_name = config.get("openAIModel") or default_openai_model
        completion_max_tokens: int = models[model_name]["max_tokens"] / 2
        model: BaseLanguageModel = ChatOpenAI(
            temperature=0,
            max_tokens=completion_max_tokens,
            model_name=model_name,
            openai_api_key=config.get("openAIKey") or default_openai_api_key,
            request_timeout=3600,
            verbose=True,
            # The max time between retries is 1 minute so we set max_retries to 45
            max_retries=45,
            streaming=False,
            callback_manager=callback_manager,
        )  # type: ignore

        return cls(
            config,
            get_envs,
            set_run_id,
            on_logs,
            on_interaction_request,
            model,
            model_name,
            e2b_api_key,
        )

    async def generate_file(
        self,
        filename: str,
        filepaths_string=None,
        shared_dependencies=None,
        prompt=None,
    ):
        # call openai api with this prompt
        print("Generating file", filename)
        filecode, metadata = await self.generate_response(
            f"""You are an AI developer who is trying to write a program that will generate code for the user based on their intent.

the app is: {prompt}

the files we have decided to generate are: {filepaths_string}

the shared dependencies (like filenames and variable names) we have decided on are: {shared_dependencies}

only write valid code for the given filepath and file type, and return only the code.
do not add any other explanation, only return valid code for that file type.
""",
            f"""
We have broken up the program into per-file generation.
Now your job is to generate only the code for the file {filename}.
Make sure to have consistent filenames if you reference other files we are also generating.

Remember that you must obey 3 things:
- you are generating code for the file {filename}
- do not stray from the names of the files and the shared dependencies we have decided on
- MOST IMPORTANT OF ALL - the purpose of our app is {prompt} - every line of code you generate must be valid code. Do not include code fences in your response, for example

Bad response:
```javascript
console.log("hello world")
```

Good response:
console.log("hello world")

Begin generating the code now.

""",
        )
        return filename, filecode, metadata

    async def generate_response(
        self,
        system_prompt: str,
        user_prompt: str,
        *args: Any,
    ):
        messages: List[BaseMessage] = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]

        # loop thru each arg and add it to messages alternating role between "assistant" and "user"
        role = "assistant"
        for value in args:
            if role == "assistant":
                messages.append(AIMessage(content=value))
            else:
                messages.append(HumanMessage(content=value))
        role = "user" if role == "assistant" else "assistant"

        model_prompt = ChatPromptValue(messages=messages)
        response = await self.model.agenerate_prompt([model_prompt])

        cost = (
            Decimal(response.llm_output["token_usage"]["prompt_tokens"])
            * models[self.model_name]["prompt"]
            + Decimal(response.llm_output["token_usage"]["completion_tokens"])
            * models[self.model_name]["completion"]
            if response.llm_output
            else None
        )

        return response.generations[0][0].text, {
            "prompt": [
                {"role": m.type, "content": m.content}
                for m in model_prompt.to_messages()
            ],
            "total_tokens": response.llm_output["token_usage"]["total_tokens"]
            if response.llm_output
            else None,
            "prompt_tokens": response.llm_output["token_usage"]["prompt_tokens"]
            if response.llm_output
            else None,
            "result_tokens": response.llm_output["token_usage"]["completion_tokens"]
            if response.llm_output
            else None,
            "cost": float(cost) if cost else None,
        }

    async def _dev(self, instructions: Any):
        with tracer.start_as_current_span("agent-run") as span:
            user_prompt: str = instructions["Prompt"]
            access_token: str = instructions["AccessToken"]
            repo: str = instructions["Repo"]
            owner: str = instructions["Owner"]
            branch: str = instructions["Branch"]
            git_app_name: str = instructions["GitHubAppName"]
            git_app_email: str = instructions["GitHubAppEmail"]
            commit_message: str = instructions["CommitMessage"]
            repo_address = (
                f"https://{git_app_name}:{access_token}@github.com/{owner}/{repo}.git"
            )

            span.set_attributes(
                {
                    "run_id": self.run_id,
                    "prompt": user_prompt,
                    "prompt.length": len(user_prompt),
                    "repository": f"{owner}/{repo}",
                }
            )

            await self.on_logs(
                {
                    "message": "Run started",
                    "type": "Run",
                    "properties": {
                        "user_prompt": user_prompt,
                        "trigger": "github",
                        "repository": f"{owner}/{repo}",
                    },
                },
            )
            playground = None
            tasks: List[asyncio.Task[Any]] = []
            try:
                playground = Playground(
                    env_id="PPSrlH5TIvFx",
                    get_envs=self.get_envs,
                    api_key=self.e2b_api_key,
                )
                rootdir = "/repo"

                async def initialize_playground():
                    await playground.open()
                    span.add_event(
                        "playground-created",
                        {
                            "playground.id": playground.id,
                        },
                    )
                    await playground.sync_clock()
                    await playground.change_rootdir(rootdir)
                    await playground.make_dir(rootdir)
                    await playground.clone_repo(
                        repo_address=repo_address,
                        rootdir=rootdir,
                        branch=branch,
                    )
                    span.add_event(
                        "repository-cloned",
                        {
                            "repository": f"{owner}/{repo}",
                        },
                    )

                    await self.on_logs(
                        {
                            "type": "GitHub",
                            "message": "Cloned repository",
                            "properties": {
                                "repository": f"{owner}/{repo}",
                            },
                        }
                    )

                    extensions = " -o ".join(
                        [f'-name "*{extension}"' for extension in extensions_to_skip]
                    )

                    delete_command = f"find . -path ./.git -prune -o ! \\( {extensions} \\) -type f -exec rm -f {{}} +"

                    print("Delete command: ", delete_command)

                    res = await playground.run_command(delete_command, rootdir)
                    print("Delete command result: ", res.stdout, res.stderr)

                    span.add_event(
                        "files-deleted",
                        {
                            "path": rootdir,
                        },
                    )

                initializing_playground = asyncio.ensure_future(initialize_playground())

                filepaths_string, metadata = await self.generate_response(
                    """You are an AI developer who is trying to write a program that will generate code for the user based on their intent.

When given their intent, create a complete, exhaustive list of filepaths that the user would write to make the program.

only list the filepaths you would write, and return them as a python list of strings.
do not add any other explanation, only return a python list of strings.
    """,
                    user_prompt,
                )

                await self.on_logs(
                    {
                        "group": {
                            "id": str(uuid.uuid4()),
                            "message": "Create a list of filepaths",
                        },
                        "message": f"Called OpenAI",
                        "properties": {
                            **metadata,
                            "result": filepaths_string,
                            "model": self.model_name,
                        },
                        "type": "LLM",
                    },
                )

                span.add_event(
                    "filepaths-generated",
                    {
                        "filepaths": filepaths_string,
                        "model": self.model_name,
                        **metadata,
                    },
                )

                # parse the result into a python list
                list_actual = ast.literal_eval(filepaths_string)

                (
                    shared_dependencies,
                    metadata,
                ) = await self.generate_response(
                    f"""You are an AI developer who is trying to write a program that will generate code for the user based on their intent.

In response to the user's prompt:

---
the app is: {user_prompt}
---

the files we have decided to generate are: {filepaths_string}

Now that we have a list of files, we need to understand what dependencies they share.
Please name and briefly describe what is shared between the files we are generating, including exported variables, data schemas, id names of every DOM elements that javascript functions will use, message names, and function names.
Exclusively focus on the names of the shared dependencies, and do not add any other explanation.
    """,
                    user_prompt,
                )

                group = {
                    "message": f"Create shared dependencies",
                    "id": str(uuid.uuid4()),
                }

                await self.on_logs(
                    {
                        "group": group,
                        "properties": {
                            **metadata,
                            "result": shared_dependencies,
                            "model": self.model_name,
                        },
                        "message": f"Called OpenAI",
                        "type": "LLM",
                    },
                )
                span.add_event(
                    "model-used",
                    {
                        "shared_dependencies": shared_dependencies,
                        "model": self.model_name,
                        **metadata,
                    },
                )

                async def save_file(name: str, content: str, group: Any):
                    filepath = os.path.join(rootdir, name)
                    await initializing_playground
                    await playground.write_file(filepath, content)
                    span.add_event(
                        "file-saved",
                        {
                            "filename": filepath,
                        },
                    )
                    await self.on_logs(
                        {
                            "type": "Filesystem",
                            "group": group,
                            "message": f"Saved file",
                            "properties": {
                                "path": filepath,
                                "content": content,
                            },
                        }
                    )

                await save_file("shared_dependencies.md", shared_dependencies, group)

                print("Filepaths:", ", ".join(list_actual))

                # Maximum number of allowed concurrent calls
                semaphore = asyncio.Semaphore(2)
                # execute the file generation in paralell and wait for all of them to finish. Use list comprehension to generate the tasks

                async def create_file(name, model_name):
                    filename, content, metadata = await self.generate_file(
                        name,
                        filepaths_string=filepaths_string,
                        shared_dependencies=shared_dependencies,
                        prompt=user_prompt,
                    )
                    group = {
                        "message": f"Create file",
                        "id": str(uuid.uuid4()),
                    }
                    await self.on_logs(
                        {
                            "group": group,
                            "message": f"Called OpenAI",
                            "properties": {
                                **metadata,
                                "result": content,
                                "model": model_name,
                            },
                            "type": "LLM",
                        },
                    )
                    await save_file(filename, content, group)

                tasks = [
                    asyncio.ensure_future(
                        with_semaphore(
                            semaphore,
                            create_file(
                                name,
                                model_name=self.model_name,
                            ),
                        )
                    )
                    for name in list_actual
                    # Filter out files that end with extensions we don't want to generate
                    if not any(
                        name.endswith(extension) for extension in extensions_to_skip
                    )
                    and not name.endswith("/")
                ]

                await asyncio.gather(*tasks)

                print("All files generated")

                await playground.push_repo(
                    rootdir=rootdir,
                    repo_address=repo_address,
                    commit_message=commit_message,
                    git_email=git_app_email,
                    git_name=git_app_name,
                )
                span.add_event(
                    "pushed-repository",
                    {
                        "repository": f"{owner}/{repo}",
                    },
                )
                await self.on_logs(
                    {
                        "message": f"Pushed repository",
                        "properties": {
                            "repository": f"{owner}/{repo}",
                        },
                        "type": "GitHub",
                    }
                )

                await self.on_interaction_request(
                    AgentInteractionRequest(
                        interaction_id=str(uuid.uuid4()),
                        type="done",
                        data={
                            "prompt": user_prompt,
                            "run_id": self.run_id,
                        },
                    )
                )
                await self.on_logs(
                    {
                        "message": f"Run finished",
                        "type": "Run",
                    }
                )
            except Exception as e:
                for t in tasks:
                    t.cancel()
                print(f"Failed agent run", e)
                await self.on_logs(
                    {
                        "message": f"Run failed",
                        "properties": {
                            "error": str(e),
                        },
                        "type": "Run",
                    },
                )
                span.set_status(Status(StatusCode.ERROR))
                span.record_exception(e)
                raise
            finally:
                if playground is not None:
                    await playground.close()
                    span.add_event(
                        "closed-playground",
                        {},
                    )

    async def _dev_in_background(self, instructions: Any):
        print("Start agent run", bool(self._dev_loop))

        if self._dev_loop:
            print("Agent run already in progress - restarting")
            await self.stop()

        self.run_id = str(uuid.uuid4())
        self.set_run_id(self.run_id)

        async def start_with_timeout():
            try:
                self._dev_loop = asyncio.create_task(
                    self._dev(instructions=instructions),
                )
                await asyncio.wait_for(
                    self._dev_loop,
                    timeout=self.max_run_time,
                )
            except asyncio.TimeoutError:
                await self.stop()
                print("Timeout")
            finally:
                self._dev_loop = None

        asyncio.create_task(
            start_with_timeout(),
        )

    async def interaction(self, interaction: AgentInteraction):
        print("Agent interaction")

        match interaction.type:
            case "start":
                await self._dev_in_background(interaction.data["instructions"])
            case _:
                raise Exception(f"Unknown interaction action: {interaction.type}")

    def is_running(self) -> bool:
        return bool(self._dev_loop)

    async def stop(self):
        print("Cancel agent run")
        await self.on_logs(
            {
                "message": f"Run cancelled",
                "type": "Run",
            },
        )
        await self.on_interaction_request(
            AgentInteractionRequest(
                interaction_id=str(uuid.uuid4()),
                type="cancelled",
                data={
                    "run_id": self.run_id,
                },
            )
        )
        if self._dev_loop:
            self._dev_loop.cancel()
