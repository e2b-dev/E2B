from e2b import ReadyCmd, Template, wait_for_url


def make_template(
    kernels: list[str] = ["python", "r", "javascript", "bash", "java"],
    is_docker: bool = False,
    ready: ReadyCmd | None = None,
    debug: bool = False,
):
    enabled_kernels = set(["python", "javascript"] + kernels)
    # Start with base template
    template = (
        Template()
        .from_image("python:3.13")
        .set_user("root")
        .set_workdir("/root")
        .set_envs(
            {
                "PIP_DEFAULT_TIMEOUT": "100",
                "PIP_DISABLE_PIP_VERSION_CHECK": "1",
                "PIP_NO_CACHE_DIR": "1",
                "JAVA_VERSION": "11",
                "JAVA_HOME": "/usr/lib/jvm/jdk-${JAVA_VERSION}",
                "IJAVA_VERSION": "1.3.0",
                "R_VERSION": "4.5.*",
            }
        )
        .apt_install(
            [
                "build-essential",
                "curl",
                "git",
                "util-linux",
                "jq",
                "sudo",
                "fonts-noto-cjk",
                "ca-certificates",
            ]
        )
        .run_cmd("curl -fsSL https://deb.nodesource.com/setup_20.x | bash -")
        .apt_install("nodejs")
        .copy("requirements.txt", "requirements.txt")
        .pip_install("--no-cache-dir -r requirements.txt")
    )

    if "python" in enabled_kernels:
        template = template.run_cmd("ipython kernel install --name 'python3' --user")

    # Install R Kernel if requested
    if "r" in enabled_kernels:
        template = template.apt_install("r-base=${R_VERSION} r-base-dev").run_cmd(
            [
                "R -e \"install.packages('IRkernel', repos='https://cloud.r-project.org')\"",
                "R -e \"IRkernel::installspec(user = FALSE, name = 'r', displayname = 'R')\"",
            ]
        )

    # Install JavaScript Kernel if requested
    if "javascript" in enabled_kernels:
        template = template.npm_install(
            "--unsafe-perm git+https://github.com/e2b-dev/ijavascript.git",
            g=True,
        ).run_cmd("ijsinstall --install=global")

    # Install Bash Kernel if requested
    if "bash" in enabled_kernels:
        template = template.pip_install("bash_kernel").run_cmd(
            "python -m bash_kernel.install"
        )

    # Install Java and Java Kernel if requested
    if "java" in enabled_kernels:
        template = template.run_cmd(
            [
                "mkdir -p /usr/lib/jvm",
                "curl -fsSL https://download.java.net/java/ga/jdk${JAVA_VERSION}/openjdk-${JAVA_VERSION}_linux-x64_bin.tar.gz | tar -xz -C /usr/lib/jvm",
                "update-alternatives --install /usr/bin/java java /usr/lib/jvm/jdk-${JAVA_VERSION}/bin/java 1",
                "update-alternatives --install /usr/bin/javac javac /usr/lib/jvm/jdk-${JAVA_VERSION}/bin/javac 1",
                "wget https://github.com/SpencerPark/IJava/releases/download/v${IJAVA_VERSION}/ijava-${IJAVA_VERSION}.zip",
                "unzip ijava-${IJAVA_VERSION}.zip",
                "python install.py --sys-prefix",
            ]
        )

    # Common setup steps (always run)
    template = (
        template
        # Create server virtual environment
        .copy("server", ".server")
        .run_cmd("python -m venv .server/.venv")
        # Copy and install server requirements
        .run_cmd(
            ".server/.venv/bin/pip install --no-cache-dir -r .server/requirements.txt"
        )
    )

    # Copy configuration files
    template = (
        template.copy("matplotlibrc", ".config/matplotlib/.matplotlibrc")
        .copy("jupyter-healthcheck.sh", ".jupyter/jupyter-healthcheck.sh")
        .run_cmd("chmod +x .jupyter/jupyter-healthcheck.sh")
        .copy("jupyter_server_config.py", ".jupyter/")
        .make_dir(".ipython/profile_default/startup")
        .copy("ipython_kernel_config.py", ".ipython/profile_default/")
        .copy("startup_scripts", ".ipython/profile_default/startup")
    )

    if not is_docker:
        template = template.copy(
            "systemd/jupyter.service", "/etc/systemd/system/jupyter.service"
        ).copy(
            "systemd/code-interpreter.service",
            "/etc/systemd/system/code-interpreter.service",
        )
        if debug:
            # Drop-in that routes Jupyter's stdout to the journal for debugging.
            template = template.copy(
                "systemd/jupyter-debug.conf",
                "/etc/systemd/system/jupyter.service.d/debug.conf",
            )
    else:
        template = template.copy("start-up.sh", ".jupyter/start-up.sh").run_cmd(
            "chmod +x .jupyter/start-up.sh"
        )

    if is_docker:
        # create user user and /home/user
        template = template.run_cmd("useradd -m user")
        template = template.run_cmd("mkdir -p /home/user")
        template = template.run_cmd("chown -R user:user /home/user")
        # add to sudoers
        template = template.run_cmd(
            "echo 'user ALL=(ALL) NOPASSWD: ALL' >> /etc/sudoers"
        )

    template = template.set_user("user").set_workdir("/home/user")

    if is_docker:
        start_cmd = "sudo --preserve-env=E2B_LOCAL /root/.jupyter/start-up.sh"
    else:
        start_cmd = "sudo systemctl start jupyter"

    if ready is None:
        ready = wait_for_url("http://localhost:49999/health")

    return template.set_start_cmd(start_cmd, ready)
