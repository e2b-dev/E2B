import asyncio
import uuid
import os
import ast

from typing import Any, List
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

from agent.base import (
    AgentInteraction,
    OnLogs,
    OnInteractionRequest,
)
from models.base import ModelConfig, get_model
from agent.base import AgentBase, AgentInteractionRequest, GetEnvs
from session.playground import Playground
from playground_client.exceptions import NotFoundException

default_openai_api_key = os.environ.get("OPENAI_API_KEY", None)

pricing = {
    "gpt-4": {
        "prompt": 0.03 / 1000,
        "completion": 0.06 / 1000,
    }
}


class SmolAgent(AgentBase):
    max_run_time = 60 * 60  # in seconds

    def __init__(
        self,
        config: Any,
        get_envs: GetEnvs,
        on_logs: OnLogs,
        on_interaction_request: OnInteractionRequest,
        model: BaseLanguageModel,
    ):
        super().__init__()
        self._dev_loop: asyncio.Task | None = None
        self.get_envs = get_envs
        self.config = config
        self.on_interaction_request = on_interaction_request
        self.on_logs = on_logs
        self.model = model

    @classmethod
    async def create(
        cls,
        config: Any,
        get_envs: GetEnvs,
        on_logs: OnLogs,
        on_interaction_request: OnInteractionRequest,
    ):
        callback_manager = AsyncCallbackManager([])
        new_config = ModelConfig(**config)

        # Use default openai api key
        new_config.args["openai_api_key"] = default_openai_api_key

        model = get_model(new_config, callback_manager)

        return cls(
            new_config,
            get_envs,
            on_logs,
            on_interaction_request,
            model,
        )

    async def generate_file(
        self,
        filename: str,
        filepaths_string=None,
        shared_dependencies=None,
        prompt=None,
    ):
        # call openai api with this prompt
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

        await self.on_logs(
            {
                "message": f"Generated file",
                "properties": {
                    **metadata,
                    "result": filecode,
                    "model": "gpt-4",
                },
                "type": "model",
            }
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
            response.llm_output["token_usage"]["prompt_tokens"]
            * pricing["gpt-4"]["prompt"]
            + response.llm_output["token_usage"]["completion_tokens"]
            * pricing["gpt-4"]["completion"]
            if response.llm_output
            else None
        )

        return response.generations[0][0].text, {
            "prompt": model_prompt.to_string(),
            "total_tokens": response.llm_output["token_usage"]["total_tokens"]
            if response.llm_output
            else None,
            "prompt_tokens": response.llm_output["token_usage"]["prompt_tokens"]
            if response.llm_output
            else None,
            "result_tokens": response.llm_output["token_usage"]["completion_tokens"]
            if response.llm_output
            else None,
            "cost": cost,
        }

    async def _dev(self, instructions: Any):
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

        await self.on_logs(
            {
                "message": f"hi its me, 🐣the smol developer🐣!",
                "type": "info",
            }
        )
        playground = None
        try:
            playground = Playground(env_id="PPSrlH5TIvFx", get_envs=self.get_envs)
            await playground.open()

            await self.on_logs(
                {
                    "message": f"Created playground",
                    "properties": {
                        "playground": "created",
                        "id": playground.id,
                    },
                    "type": "playground",
                }
            )

            fixClockDrift = asyncio.ensure_future(playground.sync_clock())

            rootdir = "/repo"
            await playground.change_rootdir(rootdir)
            await playground.make_dir(rootdir)

            await playground.clone_repo(
                repo_address=repo_address,
                rootdir=rootdir,
                branch=branch,
            )

            await self.on_logs(
                {
                    "message": f"Cloned repository",
                    "properties": {
                        "tool": "git",
                        "repository": f"{owner}/{repo}",
                    },
                    "type": "tool",
                }
            )

            extensions_to_skip = [
                ".png",
                ".jpg",
                ".jpeg",
                ".gif",
                ".bmp",
                ".svg",
                ".ico",
                ".tif",
                ".tiff",
            ]

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
                    "message": f"Generating filepaths",
                    "properties": {
                        **metadata,
                        "result": filepaths_string,
                        "model": "gpt-4",
                    },
                    "type": "model",
                }
            )

            # parse the result into a python list
            list_actual = ast.literal_eval(filepaths_string)

            # if shared_dependencies.md is there, read it in, else set it to None
            shared_dependencies: str | None = None
            try:
                shared_dependencies = await playground.read_file(
                    os.path.join(rootdir, "shared_dependencies.md")
                )
            except NotFoundException:
                pass

            files = await playground.get_filenames(rootdir, [".git"])
            for file in files:
                _, extension = os.path.splitext(file.name)
                if extension not in extensions_to_skip:
                    await playground.delete_file(file.name)

            await self.on_logs(
                {
                    "message": f"Cleaned root directory",
                    "properties": {
                        "tool": "filesystem",
                    },
                    "type": "tool",
                }
            )

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

            await self.on_logs(
                {
                    "message": f"Generated shared dependencies",
                    "properties": {
                        **metadata,
                        "result": shared_dependencies,
                        "model": "gpt-4",
                    },
                    "type": "model",
                }
            )

            # write shared dependencies as a md file inside the generated directory
            await playground.write_file(
                os.path.join(rootdir, "shared_dependencies.md"),
                shared_dependencies,
            )

            await self.on_logs(
                {
                    "message": f"Saved shared dependencies",
                    "properties": {
                        "filename": "shared_dependencies.md",
                        "content": shared_dependencies,
                        "tool": "filesystem",
                    },
                    "type": "tool",
                }
            )
            # Maximum number of allowed concurrent calls
            semaphore = asyncio.Semaphore(4)

            async def with_semaphore(coro):
                async with semaphore:
                    return await coro

            # execute the file generation in paralell and wait for all of them to finish. Use list comprehension to generate the tasks
            coros = [
                with_semaphore(
                    self.generate_file(
                        name,
                        filepaths_string=filepaths_string,
                        shared_dependencies=shared_dependencies,
                        prompt=user_prompt,
                    )
                )
                for name in list_actual
                # Filter out files that end with esxtensions we don't want to generate
                if not any(name.endswith(extension) for extension in extensions_to_skip)
            ]

            generated_files = await asyncio.gather(*coros)

            for (
                name,
                content,
                _,  # metadata
            ) in generated_files:
                filepath = os.path.join(rootdir, name)
                await playground.write_file(filepath, content)
                await self.on_logs(
                    {
                        "message": f"Saved file",
                        "properties": {
                            "filename": filepath,
                            "content": content,
                            "tool": "filesystem",
                        },
                        "type": "tool",
                    }
                )

            await fixClockDrift
            await playground.push_repo(
                rootdir=rootdir,
                repo_address=repo_address,
                commit_message=commit_message,
                git_email=git_app_email,
                git_name=git_app_name,
            )

            await self.on_logs(
                {
                    "message": f"Pushed repository",
                    "properties": {
                        "repository_url": f"https://github.com/{owner}/{repo}",
                        "branch": branch,
                        "commit_message": commit_message,
                        "tool": "git",
                    },
                    "type": "tool",
                }
            )

            await self.on_interaction_request(
                AgentInteractionRequest(
                    interaction_id=str(uuid.uuid4()),
                    type="done",
                    data={
                        "prompt": user_prompt,
                    },
                )
            )
        except:
            raise
        finally:
            if playground is not None:
                await playground.close()
                await self.on_logs(
                    {
                        "message": f"Closed playground",
                        "properties": {
                            "playground": "closed",
                        },
                        "type": "playground",
                    }
                )

    async def _dev_in_background(self, instructions: Any):
        print("Start agent run", bool(self._dev_loop))

        if self._dev_loop:
            print("Agent run already in progress - restarting")
            await self.stop()

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

    async def stop(self):
        print("Cancel agent run")
        await self.on_interaction_request(
            AgentInteractionRequest(
                interaction_id=str(uuid.uuid4()),
                type="cancelled",
                data={
                    # "associated_comment_id": self._dev_comment_id,
                },
            )
        )
        if self._dev_loop:
            self._dev_loop.cancel()
