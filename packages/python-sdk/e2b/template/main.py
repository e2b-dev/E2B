import json
from typing import Dict, List, Optional, Union, Literal
from pathlib import Path


from e2b.exceptions import BuildException
from e2b.template.consts import STACK_TRACE_DEPTH, RESOLVE_SYMLINKS
from e2b.template.dockerfile_parser import parse_dockerfile
from e2b.template.readycmd import ReadyCmd, wait_for_file
from e2b.template.types import (
    CopyItem,
    Instruction,
    TemplateType,
    RegistryConfig,
    InstructionType,
)
from e2b.template.utils import (
    calculate_files_hash,
    get_caller_directory,
    pad_octal,
    read_dockerignore,
    read_gcp_service_account_json,
    get_caller_frame,
)
from types import TracebackType


class TemplateBuilder:
    """
    Builder class for adding instructions to an E2B template.

    All methods return self to allow method chaining.
    """

    def __init__(self, template: "TemplateBase"):
        self._template = template

    def copy(
        self,
        src: Union[Union[str, Path], List[Union[str, Path]]],
        dest: Union[str, Path],
        force_upload: Optional[Literal[True]] = None,
        user: Optional[str] = None,
        mode: Optional[int] = None,
        resolve_symlinks: Optional[bool] = None,
    ) -> "TemplateBuilder":
        """
        Copy files or directories from the local filesystem into the template.

        :param src: Source file(s) or directory path(s) to copy
        :param dest: Destination path in the template
        :param force_upload: Force upload even if files are cached
        :param user: User and optionally group (user:group) to own the files
        :param mode: File permissions in octal format (e.g., 0o755)
        :param resolve_symlinks: Whether to resolve symlinks

        :return: `TemplateBuilder` class

        Example
        ```python
        template.copy('requirements.txt', '/home/user/')
        template.copy(['app.py', 'config.py'], '/app/', mode=0o755)
        ```
        """
        srcs = [src] if isinstance(src, (str, Path)) else src

        for src_item in srcs:
            args = [
                str(src_item),
                str(dest),
                user or "",
                pad_octal(mode) if mode else "",
            ]

            instruction: Instruction = {
                "type": InstructionType.COPY,
                "args": args,
                "force": force_upload or self._template._force_next_layer,
                "forceUpload": force_upload,
                "resolveSymlinks": resolve_symlinks,
            }

            self._template._instructions.append(instruction)

        self._template._collect_stack_trace()
        return self

    def copy_items(self, items: List[CopyItem]) -> "TemplateBuilder":
        """
        Copy multiple files or directories using a list of copy items.

        :param items: List of CopyItem dictionaries with src, dest, and optional parameters

        :return: `TemplateBuilder` class

        Example
        ```python
        template.copy_items([
            {'src': 'app.py', 'dest': '/app/'},
            {'src': 'config.py', 'dest': '/app/', 'mode': 0o644}
        ])
        ```
        """
        self._template._run_in_new_stack_trace_context(
            lambda: [
                self.copy(
                    item["src"],
                    item["dest"],
                    item.get("forceUpload"),
                    item.get("user"),
                    item.get("mode"),
                    item.get("resolveSymlinks"),
                )
                for item in items
            ]
        )
        return self

    def remove(
        self,
        path: Union[Union[str, Path], List[Union[str, Path]]],
        force: bool = False,
        recursive: bool = False,
        user: Optional[str] = None,
    ) -> "TemplateBuilder":
        """
        Remove files or directories in the template.

        :param path: File(s) or directory path(s) to remove
        :param force: Force removal without prompting
        :param recursive: Remove directories recursively
        :param user: User to run the command as

        :return: `TemplateBuilder` class

        Example
        ```python
        template.remove('/tmp/cache', recursive=True, force=True)
        template.remove('/tmp/cache', recursive=True, force=True, user='root')
        ```
        """
        paths = [path] if isinstance(path, (str, Path)) else path
        args = ["rm"]
        if recursive:
            args.append("-r")
        if force:
            args.append("-f")
        args.extend([str(p) for p in paths])

        return self._template._run_in_new_stack_trace_context(
            lambda: self.run_cmd(" ".join(args), user=user)
        )

    def rename(
        self,
        src: Union[str, Path],
        dest: Union[str, Path],
        force: bool = False,
        user: Optional[str] = None,
    ) -> "TemplateBuilder":
        """
        Rename or move a file or directory in the template.

        :param src: Source path
        :param dest: Destination path
        :param force: Force rename without prompting
        :param user: User to run the command as

        :return: `TemplateBuilder` class

        Example
        ```python
        template.rename('/tmp/old.txt', '/tmp/new.txt')
        template.rename('/tmp/old.txt', '/tmp/new.txt', user='root')
        ```
        """
        args = ["mv", str(src), str(dest)]
        if force:
            args.append("-f")

        return self._template._run_in_new_stack_trace_context(
            lambda: self.run_cmd(" ".join(args), user=user)
        )

    def make_dir(
        self,
        path: Union[Union[str, Path], List[Union[str, Path]]],
        mode: Optional[int] = None,
        user: Optional[str] = None,
    ) -> "TemplateBuilder":
        """
        Create directory(ies) in the template.

        :param path: Directory path(s) to create
        :param mode: Directory permissions in octal format (e.g., 0o755)
        :param user: User to run the command as

        :return: `TemplateBuilder` class

        Example
        ```python
        template.make_dir('/app/data', mode=0o755)
        template.make_dir(['/app/logs', '/app/cache'])
        template.make_dir('/app/data', mode=0o755, user='root')
        ```
        """
        path_list = [path] if isinstance(path, (str, Path)) else path
        args = ["mkdir", "-p"]
        if mode:
            args.append(f"-m {pad_octal(mode)}")
        args.extend([str(p) for p in path_list])

        return self._template._run_in_new_stack_trace_context(
            lambda: self.run_cmd(" ".join(args), user=user)
        )

    def make_symlink(
        self,
        src: Union[str, Path],
        dest: Union[str, Path],
        user: Optional[str] = None,
        force: bool = False,
    ) -> "TemplateBuilder":
        """
        Create a symbolic link in the template.

        :param src: Source path (target of the symlink)
        :param dest: Destination path (location of the symlink)
        :param user: User to run the command as
        :param force: Force symlink without prompting

        :return: `TemplateBuilder` class

        Example
        ```python
        template.make_symlink('/usr/bin/python3', '/usr/bin/python')
        template.make_symlink('/usr/bin/python3', '/usr/bin/python', user='root')
        template.make_symlink('/usr/bin/python3', '/usr/bin/python', force=True)
        ```
        """
        args = ["ln", "-s"]
        if force:
            args.append("-f")
        args.extend([str(src), str(dest)])
        return self._template._run_in_new_stack_trace_context(
            lambda: self.run_cmd(" ".join(args), user=user)
        )

    def run_cmd(
        self, command: Union[str, List[str]], user: Optional[str] = None
    ) -> "TemplateBuilder":
        """
        Run a shell command during template build.

        :param command: Command string or list of commands to run (joined with &&)
        :param user: User to run the command as

        :return: `TemplateBuilder` class

        Example
        ```python
        template.run_cmd('apt-get update')
        template.run_cmd(['pip install numpy', 'pip install pandas'])
        template.run_cmd('apt-get install vim', user='root')
        ```
        """
        commands = [command] if isinstance(command, str) else command
        args = [" && ".join(commands)]

        if user:
            args.append(user)

        instruction: Instruction = {
            "type": InstructionType.RUN,
            "args": args,
            "force": self._template._force_next_layer,
            "forceUpload": None,
        }
        self._template._instructions.append(instruction)
        self._template._collect_stack_trace()
        return self

    def set_workdir(self, workdir: Union[str, Path]) -> "TemplateBuilder":
        """
        Set the working directory for subsequent commands in the template.

        :param workdir: Path to set as the working directory

        :return: `TemplateBuilder` class

        Example
        ```python
        template.set_workdir('/app')
        ```
        """
        instruction: Instruction = {
            "type": InstructionType.WORKDIR,
            "args": [str(workdir)],
            "force": self._template._force_next_layer,
            "forceUpload": None,
        }
        self._template._instructions.append(instruction)
        self._template._collect_stack_trace()
        return self

    def set_user(self, user: str) -> "TemplateBuilder":
        """
        Set the user for subsequent commands in the template.

        :param user: Username to set

        :return: `TemplateBuilder` class

        Example
        ```python
        template.set_user('root')
        ```
        """
        instruction: Instruction = {
            "type": InstructionType.USER,
            "args": [user],
            "force": self._template._force_next_layer,
            "forceUpload": None,
        }
        self._template._instructions.append(instruction)
        self._template._collect_stack_trace()
        return self

    def pip_install(
        self, packages: Optional[Union[str, List[str]]] = None, g: bool = True
    ) -> "TemplateBuilder":
        """
        Install Python packages using pip.

        :param packages: Package name(s) to install. If None, runs 'pip install .' in the current directory
        :param g: Install packages globally (default: True). If False, installs for user only

        :return: `TemplateBuilder` class

        Example
        ```python
        template.pip_install('numpy')
        template.pip_install(['pandas', 'scikit-learn'])
        template.pip_install('numpy', g=False)  # Install for user only
        template.pip_install()  # Installs from current directory
        ```
        """
        if isinstance(packages, str):
            packages = [packages]

        args = ["pip", "install"]
        if not g:
            args.append("--user")
        if packages:
            args.extend(packages)
        else:
            args.append(".")

        return self._template._run_in_new_stack_trace_context(
            lambda: self.run_cmd(" ".join(args), user="root" if g else None)
        )

    def npm_install(
        self,
        packages: Optional[Union[str, List[str]]] = None,
        g: Optional[bool] = False,
        dev: Optional[bool] = False,
    ) -> "TemplateBuilder":
        """
        Install Node.js packages using npm.

        :param packages: Package name(s) to install. If None, installs from package.json
        :param g: Install packages globally
        :param dev: Install packages as dev dependencies

        :return: `TemplateBuilder` class

        Example
        ```python
        template.npm_install('express')
        template.npm_install(['lodash', 'axios'])
        template.npm_install('typescript', g=True)
        template.npm_install()  # Installs from package.json
        ```
        """
        if isinstance(packages, str):
            packages = [packages]

        args = ["npm", "install"]
        if g:
            args.append("-g")
        if dev:
            args.append("--save-dev")
        if packages:
            args.extend(packages)

        return self._template._run_in_new_stack_trace_context(
            lambda: self.run_cmd(" ".join(args), user="root" if g else None)
        )

    def bun_install(
        self,
        packages: Optional[Union[str, List[str]]] = None,
        g: Optional[bool] = False,
        dev: Optional[bool] = False,
    ) -> "TemplateBuilder":
        """
        Install Bun packages using bun.

        :param packages: Package name(s) to install. If None, installs from package.json
        :param g: Install packages globally
        :param dev: Install packages as dev dependencies

        :return: `TemplateBuilder` class

        Example
        ```python
        template.bun_install('express')
        template.bun_install(['lodash', 'axios'])
        template.bun_install('tsx', g=True)
        template.bun_install('typescript', dev=True)
        template.bun_install()  // Installs from package.json
        ```
        """
        if isinstance(packages, str):
            packages = [packages]

        args = ["bun", "install"]
        if g:
            args.append("-g")
        if dev:
            args.append("--dev")
        if packages:
            args.extend(packages)

        return self._template._run_in_new_stack_trace_context(
            lambda: self.run_cmd(" ".join(args), user="root" if g else None)
        )

    def apt_install(
        self, packages: Union[str, List[str]], no_install_recommends: bool = False
    ) -> "TemplateBuilder":
        """
        Install system packages using apt-get.

        :param packages: Package name(s) to install
        :param no_install_recommends: Whether to install recommended packages

        :return: `TemplateBuilder` class

        Example
        ```python
        template.apt_install('vim')
        template.apt_install(['git', 'curl', 'wget'])
        ```
        """
        if isinstance(packages, str):
            packages = [packages]

        return self._template._run_in_new_stack_trace_context(
            lambda: self.run_cmd(
                [
                    "apt-get update",
                    f"DEBIAN_FRONTEND=noninteractive DEBCONF_NOWARNINGS=yes apt-get install -y {'--no-install-recommends ' if no_install_recommends else ''}{' '.join(packages)}",
                ],
                user="root",
            )
        )

    def add_mcp_server(self, servers: Union[str, List[str]]) -> "TemplateBuilder":
        """
        Install MCP servers using mcp-gateway.

        Note: Requires a base image with mcp-gateway pre-installed (e.g., mcp-gateway).

        :param servers: MCP server name(s)

        :return: `TemplateBuilder` class

        Example
        ```python
        template.add_mcp_server('exa')
        template.add_mcp_server(['brave', 'firecrawl', 'duckduckgo'])
        ```
        """
        if self._template._base_template != "mcp-gateway":
            caller_frame = get_caller_frame(STACK_TRACE_DEPTH - 1)
            stack_trace = None
            if caller_frame is not None:
                stack_trace = TracebackType(
                    tb_next=None,
                    tb_frame=caller_frame,
                    tb_lasti=caller_frame.f_lasti,
                    tb_lineno=caller_frame.f_lineno,
                )
            raise BuildException(
                "MCP servers can only be added to mcp-gateway template"
            ).with_traceback(stack_trace)

        if isinstance(servers, str):
            servers = [servers]

        return self._template._run_in_new_stack_trace_context(
            lambda: self.run_cmd(f"mcp-gateway pull {' '.join(servers)}", user="root")
        )

    def git_clone(
        self,
        url: str,
        path: Optional[Union[str, Path]] = None,
        branch: Optional[str] = None,
        depth: Optional[int] = None,
        user: Optional[str] = None,
    ) -> "TemplateBuilder":
        """
        Clone a git repository into the template.

        :param url: Git repository URL
        :param path: Destination path for the clone
        :param branch: Branch to clone
        :param depth: Clone depth for shallow clones
        :param user: User to run the command as

        :return: `TemplateBuilder` class

        Example
        ```python
        template.git_clone('https://github.com/user/repo.git', '/app/repo')
        template.git_clone('https://github.com/user/repo.git', branch='main', depth=1)
        template.git_clone('https://github.com/user/repo.git', '/app/repo', user='root')
        ```
        """
        args = ["git", "clone", url]
        if branch:
            args.append(f"--branch {branch}")
            args.append("--single-branch")
        if depth:
            args.append(f"--depth {depth}")
        if path:
            args.append(str(path))
        return self._template._run_in_new_stack_trace_context(
            lambda: self.run_cmd(" ".join(args), user=user)
        )

    def beta_dev_container_prebuild(
        self,
        devcontainer_directory: Union[str, Path],
    ) -> "TemplateBuilder":
        """
        Prebuild a devcontainer from the specified directory during the build process.

        :param devcontainer_directory: Path to the devcontainer directory

        :return: `TemplateBuilder` class

        Example
        ```python
        template.git_clone('https://myrepo.com/project.git', '/my-devcontainer')
        template.beta_dev_container_prebuild('/my-devcontainer')
        ```
        """
        if self._template._base_template != "devcontainer":
            caller_frame = get_caller_frame(STACK_TRACE_DEPTH - 1)
            stack_trace = None
            if caller_frame is not None:
                stack_trace = TracebackType(
                    tb_next=None,
                    tb_frame=caller_frame,
                    tb_lasti=caller_frame.f_lasti,
                    tb_lineno=caller_frame.f_lineno,
                )
            raise BuildException(
                "Devcontainers can only used in the devcontainer template"
            ).with_traceback(stack_trace)

        return self._template._run_in_new_stack_trace_context(
            lambda: self.run_cmd(
                f"devcontainer build --workspace-folder {devcontainer_directory}",
                user="root",
            )
        )

    def beta_set_dev_container_start(
        self,
        devcontainer_directory: Union[str, Path],
    ) -> "TemplateFinal":
        """
        Start a devcontainer from the specified directory and set it as the start command.

        This method returns `TemplateFinal`, which means it must be the last method in the chain.

        :param devcontainer_directory: Path to the devcontainer directory

        :return: `TemplateFinal` class

        Example
        ```python
        # Simple start
        template.git_clone('https://myrepo.com/project.git', '/my-devcontainer')
        template.beta_set_devcontainer_start('/my-devcontainer')

        # With prebuild
        template.git_clone('https://myrepo.com/project.git', '/my-devcontainer')
        template.beta_dev_container_prebuild('/my-devcontainer')
        template.beta_set_dev_container_start('/my-devcontainer')
        ```
        """
        if self._template._base_template != "devcontainer":
            caller_frame = get_caller_frame(STACK_TRACE_DEPTH - 1)
            stack_trace = None
            if caller_frame is not None:
                stack_trace = TracebackType(
                    tb_next=None,
                    tb_frame=caller_frame,
                    tb_lasti=caller_frame.f_lasti,
                    tb_lineno=caller_frame.f_lineno,
                )
            raise BuildException(
                "Devcontainers can only used in the devcontainer template"
            ).with_traceback(stack_trace)

        def _set_start():
            return self.set_start_cmd(
                "sudo devcontainer up --workspace-folder "
                + str(devcontainer_directory)
                + " && sudo /prepare-exec.sh "
                + str(devcontainer_directory)
                + " | sudo tee /devcontainer.sh > /dev/null && sudo chmod +x /devcontainer.sh && sudo touch /devcontainer.up",
                wait_for_file("/devcontainer.up"),
            )

        return self._template._run_in_new_stack_trace_context(_set_start)

    def set_envs(self, envs: Dict[str, str]) -> "TemplateBuilder":
        """
        Set environment variables in the template.

        :param envs: Dictionary of environment variable names and values

        :return: `TemplateBuilder` class

        Example
        ```python
        template.set_envs({'NODE_ENV': 'production', 'PORT': '8080'})
        ```
        """
        if len(envs) == 0:
            return self

        instruction: Instruction = {
            "type": InstructionType.ENV,
            "args": [item for key, value in envs.items() for item in [key, value]],
            "force": self._template._force_next_layer,
            "forceUpload": None,
        }
        self._template._instructions.append(instruction)
        self._template._collect_stack_trace()
        return self

    def skip_cache(self) -> "TemplateBuilder":
        """
        Skip cache for all subsequent build instructions from this point.

        Call this before any instruction to force it and all following layers
        to be rebuilt, ignoring any cached layers.

        :return: `TemplateBuilder` class

        Example
        ```python
        template.skip_cache().run_cmd('apt-get update')
        ```
        """
        self._template._force_next_layer = True
        return self

    def set_start_cmd(
        self, start_cmd: str, ready_cmd: Union[str, ReadyCmd]
    ) -> "TemplateFinal":
        """
        Set the command to start when the sandbox launches and the ready check command.

        :param start_cmd: Command to run when the sandbox starts
        :param ready_cmd: Command or ReadyCmd to check if the sandbox is ready

        :return: `TemplateFinal` class

        Example
        ```python
        # Using a string command
        template.set_start_cmd(
            'python app.py',
            'curl http://localhost:8000/health'
        )

        # Using ReadyCmd helpers
        from e2b import wait_for_port, wait_for_url

        template.set_start_cmd(
            'python -m http.server 8000',
            wait_for_port(8000)
        )

        template.set_start_cmd(
            'npm start',
            wait_for_url('http://localhost:3000/health', 200)
        )
        ```
        """
        self._template._start_cmd = start_cmd

        if isinstance(ready_cmd, ReadyCmd):
            ready_cmd = ready_cmd.get_cmd()

        self._template._ready_cmd = ready_cmd
        self._template._collect_stack_trace()
        return TemplateFinal(self._template)

    def set_ready_cmd(self, ready_cmd: Union[str, ReadyCmd]) -> "TemplateFinal":
        """
        Set the command to check if the sandbox is ready.

        :param ready_cmd: Command or ReadyCmd to check if the sandbox is ready

        :return: `TemplateFinal` class

        Example
        ```python
        # Using a string command
        template.set_ready_cmd('curl http://localhost:8000/health')

        # Using ReadyCmd helpers
        from e2b import wait_for_port, wait_for_file, wait_for_process

        template.set_ready_cmd(wait_for_port(3000))

        template.set_ready_cmd(wait_for_file('/tmp/ready'))

        template.set_ready_cmd(wait_for_process('nginx'))
        ```
        """
        if isinstance(ready_cmd, ReadyCmd):
            ready_cmd = ready_cmd.get_cmd()

        self._template._ready_cmd = ready_cmd
        self._template._collect_stack_trace()
        return TemplateFinal(self._template)


class TemplateFinal:
    """
    Final template state after start/ready commands are set.
    """

    def __init__(self, template: "TemplateBase"):
        self._template = template


class TemplateBase:
    """
    Base class for building E2B sandbox templates.
    """

    _logs_refresh_frequency = 0.2

    def __init__(
        self,
        file_context_path: Optional[Union[str, Path]] = None,
        file_ignore_patterns: Optional[List[str]] = None,
    ):
        """
        Create a new template builder instance.

        :param file_context_path: Base path for resolving relative file paths in copy operations
        :param file_ignore_patterns: List of glob patterns to ignore when copying files
        """
        self._default_base_image: str = "e2bdev/base"
        self._base_image: Optional[str] = self._default_base_image
        self._base_template: Optional[str] = None
        self._registry_config: Optional[RegistryConfig] = None
        self._start_cmd: Optional[str] = None
        self._ready_cmd: Optional[str] = None
        # Force the whole template to be rebuilt
        self._force: bool = False
        # Force the next layer to be rebuilt
        self._force_next_layer: bool = False
        self._instructions: List[Instruction] = []
        # If no file_context_path is provided, use the caller's directory
        self._file_context_path = (
            file_context_path.as_posix()
            if isinstance(file_context_path, Path)
            else (file_context_path or get_caller_directory(STACK_TRACE_DEPTH) or ".")
        )
        self._file_ignore_patterns: List[str] = file_ignore_patterns or []
        self._stack_traces: List[Union[TracebackType, None]] = []
        self._stack_traces_enabled: bool = True
        self._stack_traces_override: Optional[Union[TracebackType, None]] = None

    def skip_cache(self) -> "TemplateBase":
        """
        Skip cache for all subsequent build instructions from this point.

        :return: `TemplateBase` class

        Example
        ```python
        template.skip_cache().from_python_image('3.11')
        ```
        """
        self._force_next_layer = True
        return self

    def _collect_stack_trace(
        self, stack_traces_depth: int = STACK_TRACE_DEPTH
    ) -> "TemplateBase":
        """
        Collect the current stack trace for debugging purposes.

        :param stack_traces_depth: Depth to traverse in the call stack

        :return: `TemplateBase` class
        """
        if not self._stack_traces_enabled:
            return self

        # Use the override if set, otherwise get the caller frame
        if self._stack_traces_override is not None:
            self._stack_traces.append(self._stack_traces_override)
            return self

        stack = get_caller_frame(stack_traces_depth)
        if stack is None:
            self._stack_traces.append(None)
            return self

        # Create a traceback object from the caller frame
        capture_stack_trace = TracebackType(
            tb_next=None,
            tb_frame=stack,
            tb_lasti=stack.f_lasti,
            tb_lineno=stack.f_lineno,
        )

        self._stack_traces.append(capture_stack_trace)
        return self

    def _disable_stack_trace(self) -> "TemplateBase":
        """
        Temporarily disable stack trace collection.

        :return: `TemplateBase` class
        """
        self._stack_traces_enabled = False
        return self

    def _enable_stack_trace(self) -> "TemplateBase":
        """
        Re-enable stack trace collection.

        :return: `TemplateBase` class
        """
        self._stack_traces_enabled = True
        return self

    def _run_in_new_stack_trace_context(self, fn):
        """
        Execute a function in a clean stack trace context.

        :param fn: Function to execute

        :return: The result of the function
        """
        self._disable_stack_trace()
        result = fn()
        self._enable_stack_trace()
        self._collect_stack_trace(STACK_TRACE_DEPTH + 1)
        return result

    def _run_in_stack_trace_override_context(
        self, fn, stack_trace_override: Optional[Union[TracebackType, None]]
    ):
        """
        Execute a function with a manual stack trace override.

        :param fn: Function to execute
        :param stack_trace_override: Stack trace to use instead of auto-collecting

        :return: The result of the function
        """
        self._stack_traces_override = stack_trace_override
        result = fn()
        self._stack_traces_override = None
        return result

    # Built-in image mixins
    def from_debian_image(self, variant: str = "stable") -> TemplateBuilder:
        """
        Start template from a Debian base image.

        :param variant: Debian image variant

        :return: `TemplateBuilder` class

        Example
        ```python
        Template().from_debian_image('bookworm')
        ```
        """
        return self._run_in_new_stack_trace_context(
            lambda: self.from_image(f"debian:{variant}")
        )

    def from_ubuntu_image(self, variant: str = "latest") -> TemplateBuilder:
        """
        Start template from an Ubuntu base image.

        :param variant: Ubuntu image variant (default: 'latest')

        :return: `TemplateBuilder` class

        Example
        ```python
        Template().from_ubuntu_image('24.04')
        ```
        """
        return self._run_in_new_stack_trace_context(
            lambda: self.from_image(f"ubuntu:{variant}")
        )

    def from_python_image(self, version: str = "3") -> TemplateBuilder:
        """
        Start template from a Python base image.

        :param version: Python version (default: '3')

        :return: `TemplateBuilder` class

        Example
        ```python
        Template().from_python_image('3')
        ```
        """
        return self._run_in_new_stack_trace_context(
            lambda: self.from_image(f"python:{version}")
        )

    def from_node_image(self, variant: str = "lts") -> TemplateBuilder:
        """
        Start template from a Node.js base image.

        :param variant: Node.js image variant (default: 'lts')

        :return: `TemplateBuilder` class

        Example
        ```python
        Template().from_node_image('24')
        ```
        """
        return self._run_in_new_stack_trace_context(
            lambda: self.from_image(f"node:{variant}")
        )

    def from_bun_image(self, variant: str = "latest") -> TemplateBuilder:
        """
        Start template from a Bun base image.

        :param variant: Bun image variant (default: 'latest')

        :return: `TemplateBuilder` class
        """
        return self._run_in_new_stack_trace_context(
            lambda: self.from_image(f"oven/bun:{variant}")
        )

    def from_base_image(self) -> TemplateBuilder:
        """
        Start template from the E2B base image (e2bdev/base:latest).

        :return: `TemplateBuilder` class

        Example
        ```python
        Template().from_base_image()
        ```
        """
        return self._run_in_new_stack_trace_context(
            lambda: self.from_image(self._default_base_image)
        )

    def from_image(
        self,
        image: str,
        username: Optional[str] = None,
        password: Optional[str] = None,
    ) -> TemplateBuilder:
        """
        Start template from a Docker image.

        :param image: Docker image name (e.g., 'ubuntu:24.04')
        :param username: Username for private registry authentication
        :param password: Password for private registry authentication

        :return: `TemplateBuilder` class

        Example
        ```python
        Template().from_image('python:3')

        # With credentials (optional)
        Template().from_image('myregistry.com/myimage:latest', username='user', password='pass')
        ```
        """
        self._base_image = image
        self._base_template = None

        # Set the registry config if provided
        if username and password:
            self._registry_config = {
                "type": "registry",
                "username": username,
                "password": password,
            }

        # If we should force the next layer and it's a FROM command, invalidate whole template
        if self._force_next_layer:
            self._force = True

        self._collect_stack_trace()
        return TemplateBuilder(self)

    def from_template(self, template: str) -> TemplateBuilder:
        """
        Start template from an existing E2B template.

        :param template: E2B template ID or alias

        :return: `TemplateBuilder` class

        Example
        ```python
        Template().from_template('my-base-template')
        ```
        """
        self._base_template = template
        self._base_image = None

        # If we should force the next layer and it's a FROM command, invalidate whole template
        if self._force_next_layer:
            self._force = True

        self._collect_stack_trace()
        return TemplateBuilder(self)

    def from_dockerfile(self, dockerfile_content_or_path: str) -> TemplateBuilder:
        """
        Parse a Dockerfile and convert it to Template SDK format.

        :param dockerfile_content_or_path: Either the Dockerfile content as a string, or a path to a Dockerfile file

        :return: `TemplateBuilder` class

        Example
        ```python
        Template().from_dockerfile('Dockerfile')
        Template().from_dockerfile('FROM python:3\\nRUN pip install numpy')
        ```
        """
        # Create a TemplateBuilder first to use its methods
        builder = TemplateBuilder(self)

        # Get the caller frame to use for stack trace override
        # -1 as we're going up the call stack from the parse_dockerfile function
        caller_frame = get_caller_frame(STACK_TRACE_DEPTH - 1)
        stack_trace_override = None
        if caller_frame is not None:
            stack_trace_override = TracebackType(
                tb_next=None,
                tb_frame=caller_frame,
                tb_lasti=caller_frame.f_lasti,
                tb_lineno=caller_frame.f_lineno,
            )

        # Parse the dockerfile using the builder as the interface
        base_image = self._run_in_stack_trace_override_context(
            lambda: parse_dockerfile(dockerfile_content_or_path, builder),
            stack_trace_override,
        )
        self._base_image = base_image

        # If we should force the next layer and it's a FROM command, invalidate whole template
        if self._force_next_layer:
            self._force = True

        self._collect_stack_trace()
        return builder

    def from_aws_registry(
        self,
        image: str,
        access_key_id: str,
        secret_access_key: str,
        region: str,
    ) -> TemplateBuilder:
        """
        Start template from an AWS ECR registry image.

        :param image: Docker image name from AWS ECR
        :param access_key_id: AWS access key ID
        :param secret_access_key: AWS secret access key
        :param region: AWS region

        :return: `TemplateBuilder` class

        Example
        ```python
        Template().from_aws_registry(
            '123456789.dkr.ecr.us-west-2.amazonaws.com/myimage:latest',
            access_key_id='AKIA...',
            secret_access_key='...',
            region='us-west-2'
        )
        ```
        """
        self._base_image = image
        self._base_template = None

        # Set the registry config if provided
        self._registry_config = {
            "type": "aws",
            "awsAccessKeyId": access_key_id,
            "awsSecretAccessKey": secret_access_key,
            "awsRegion": region,
        }

        # If we should force the next layer and it's a FROM command, invalidate whole template
        if self._force_next_layer:
            self._force = True

        self._collect_stack_trace()
        return TemplateBuilder(self)

    def from_gcp_registry(
        self, image: str, service_account_json: Union[str, dict]
    ) -> TemplateBuilder:
        """
        Start template from a GCP Artifact Registry or Container Registry image.

        :param image: Docker image name from GCP registry
        :param service_account_json: Service account JSON string, dict, or path to JSON file

        :return: `TemplateBuilder` class

        Example
        ```python
        Template().from_gcp_registry(
            'gcr.io/myproject/myimage:latest',
            service_account_json='path/to/service-account.json'
        )
        ```
        """
        self._base_image = image
        self._base_template = None

        # Set the registry config if provided
        self._registry_config = {
            "type": "gcp",
            "serviceAccountJson": read_gcp_service_account_json(
                self._file_context_path, service_account_json
            ),
        }

        # If we should force the next layer and it's a FROM command, invalidate whole template
        if self._force_next_layer:
            self._force = True

        self._collect_stack_trace()
        return TemplateBuilder(self)

    @staticmethod
    def to_json(template: "TemplateClass") -> str:
        """
        Convert a template to JSON representation.

        :param template: The template to convert (TemplateBuilder or TemplateFinal instance)

        :return: JSON string representation of the template

        Example
        ```python
        template = Template().from_python_image('3').copy('app.py', '/app/')
        json_str = TemplateBase.to_json(template)
        ```
        """
        return json.dumps(
            template._template._serialize(
                template._template._instructions_with_hashes()
            ),
            indent=2,
        )

    @staticmethod
    def to_dockerfile(template: "TemplateClass") -> str:
        """
        Convert a template to Dockerfile format.

        Note: Templates based on other E2B templates cannot be converted to Dockerfile.

        :param template: The template to convert (TemplateBuilder or TemplateFinal instance)

        :return: Dockerfile string representation

        :raises ValueError: If the template is based on another E2B template or has no base image

        Example
        ```python
        template = Template().from_python_image('3').copy('app.py', '/app/')
        dockerfile = TemplateBase.to_dockerfile(template)
        ```
        """
        if template._template._base_template is not None:
            raise ValueError(
                "Cannot convert template built from another template to Dockerfile. "
                "Templates based on other templates can only be built using the E2B API."
            )

        if template._template._base_image is None:
            raise ValueError("No base image specified for template")

        dockerfile = f"FROM {template._template._base_image}\n"

        for instruction in template._template._instructions:
            if instruction["type"] == InstructionType.RUN:
                dockerfile += f"RUN {instruction['args'][0]}\n"
                continue

            if instruction["type"] == InstructionType.COPY:
                dockerfile += (
                    f"COPY {instruction['args'][0]} {instruction['args'][1]}\n"
                )
                continue

            if instruction["type"] == InstructionType.ENV:
                args = instruction["args"]
                values = []
                for i in range(0, len(args), 2):
                    values.append(f"{args[i]}={args[i + 1]}")
                dockerfile += f"ENV {' '.join(values)}\n"
                continue

            dockerfile += (
                f"{instruction['type'].value} {' '.join(instruction['args'])}\n"
            )

        if template._template._start_cmd:
            dockerfile += f"ENTRYPOINT {template._template._start_cmd}\n"

        return dockerfile

    def _instructions_with_hashes(
        self,
    ) -> List[Instruction]:
        """
        Add file hashes to COPY instructions for cache invalidation.

        :return: Copy of instructions list with filesHash added to COPY instructions
        """
        steps: List[Instruction] = []

        for index, instruction in enumerate(self._instructions):
            step: Instruction = {
                "type": instruction["type"],
                "args": instruction["args"],
                "force": instruction["force"],
                "forceUpload": instruction.get("forceUpload"),
                "resolveSymlinks": instruction.get("resolveSymlinks"),
            }

            if instruction["type"] == InstructionType.COPY:
                stack_trace = None
                if index + 1 < len(self._stack_traces):
                    stack_trace = self._stack_traces[index + 1]

                args = instruction.get("args", [])
                src = args[0] if len(args) > 0 else None
                dest = args[1] if len(args) > 1 else None
                if src is None or dest is None:
                    raise ValueError("Source path and destination path are required")

                resolve_symlinks = instruction.get("resolveSymlinks")
                step["filesHash"] = calculate_files_hash(
                    src,
                    dest,
                    self._file_context_path,
                    [
                        *self._file_ignore_patterns,
                        *read_dockerignore(self._file_context_path),
                    ],
                    resolve_symlinks
                    if resolve_symlinks is not None
                    else RESOLVE_SYMLINKS,
                    stack_trace,
                )

            steps.append(step)

        return steps

    def _serialize(self, steps: List[Instruction]) -> TemplateType:
        """
        Serialize the template to the API request format.

        :param steps: List of build instructions with file hashes

        :return: Template data formatted for the API
        """
        _steps: List[Instruction] = []

        for _, instruction in enumerate(steps):
            step: Instruction = {
                "type": instruction.get("type"),
                "args": instruction.get("args"),
                "force": instruction.get("force"),
            }

            files_hash = instruction.get("filesHash")
            if files_hash is not None:
                step["filesHash"] = files_hash

            force_upload = instruction.get("forceUpload")
            if force_upload is not None:
                step["forceUpload"] = force_upload

            _steps.append(step)

        template_data: TemplateType = {
            "steps": _steps,
            "force": self._force,
        }

        if self._base_image is not None:
            template_data["fromImage"] = self._base_image

        if self._base_template is not None:
            template_data["fromTemplate"] = self._base_template

        if self._registry_config is not None:
            template_data["fromImageRegistry"] = self._registry_config

        if self._start_cmd is not None:
            template_data["startCmd"] = self._start_cmd

        if self._ready_cmd is not None:
            template_data["readyCmd"] = self._ready_cmd

        return template_data


TemplateClass = Union[TemplateFinal, TemplateBuilder]
