import pytest

from e2b import DockerfileSyntaxError, Template
from e2b.template.types import InstructionType


@pytest.mark.skip_debug()
def test_from_dockerfile():
    dockerfile = """FROM node:24
WORKDIR /app
COPY package.json .
RUN npm install
ENTRYPOINT ["sleep", "20"]"""

    template = Template().from_dockerfile(dockerfile)

    # base image
    assert template._template._base_image == "node:24"

    instructions = template._template._instructions

    # Docker defaults
    assert instructions[1]["type"] == InstructionType.WORKDIR
    assert instructions[1]["args"][0] == "/"

    # Instructions from Dockerfile
    assert instructions[2]["type"] == InstructionType.WORKDIR
    assert instructions[2]["args"][0] == "/app"

    assert instructions[3]["type"] == InstructionType.COPY
    assert instructions[3]["args"][0] == "package.json"
    assert instructions[3]["args"][1] == "."

    assert instructions[4]["type"] == InstructionType.RUN
    assert instructions[4]["args"][0] == "npm install"

    # E2B defaults appended
    assert instructions[5]["type"] == InstructionType.USER
    assert instructions[5]["args"][0] == "user"

    # Start command
    assert template._template._start_cmd == "sleep 20"


@pytest.mark.skip_debug()
def test_from_dockerfile_with_default_user_and_workdir():
    dockerfile = "FROM node:24"

    template = Template().from_dockerfile(dockerfile)

    assert template._template._instructions[-2]["type"] == InstructionType.USER
    assert template._template._instructions[-2]["args"][0] == "user"
    assert template._template._instructions[-1]["type"] == InstructionType.WORKDIR
    assert template._template._instructions[-1]["args"][0] == "/home/user"


@pytest.mark.skip_debug()
def test_from_dockerfile_with_custom_user_and_workdir():
    dockerfile = "FROM node:24\nUSER mish\nWORKDIR /home/mish"

    template = Template().from_dockerfile(dockerfile)

    assert template._template._instructions[-2]["type"] == InstructionType.USER
    assert template._template._instructions[-2]["args"][0] == "mish"
    assert template._template._instructions[-1]["type"] == InstructionType.WORKDIR
    assert template._template._instructions[-1]["args"][0] == "/home/mish"


@pytest.mark.skip_debug()
def test_from_dockerfile_with_multi_source_copy():
    dockerfile = """FROM node:24
COPY file1.txt file2.txt file3.txt /dest/"""

    template = Template().from_dockerfile(dockerfile)

    instructions = template._template._instructions

    copy_instructions = [i for i in instructions if i["type"] == InstructionType.COPY]

    assert len(copy_instructions) == 3
    assert copy_instructions[0]["args"][0] == "file1.txt"
    assert copy_instructions[0]["args"][1] == "/dest/"
    assert copy_instructions[1]["args"][0] == "file2.txt"
    assert copy_instructions[1]["args"][1] == "/dest/"
    assert copy_instructions[2]["args"][0] == "file3.txt"
    assert copy_instructions[2]["args"][1] == "/dest/"


@pytest.mark.skip_debug()
def test_from_dockerfile_with_multi_source_copy_chown():
    dockerfile = """FROM node:24
COPY --chown=myuser:mygroup pkg.json pkg-lock.json /app/"""

    template = Template().from_dockerfile(dockerfile)

    instructions = template._template._instructions

    copy_instructions = [i for i in instructions if i["type"] == InstructionType.COPY]

    assert len(copy_instructions) == 2
    assert copy_instructions[0]["args"][0] == "pkg.json"
    assert copy_instructions[0]["args"][1] == "/app/"
    assert copy_instructions[0]["args"][2] == "myuser:mygroup"
    assert copy_instructions[1]["args"][0] == "pkg-lock.json"
    assert copy_instructions[1]["args"][1] == "/app/"
    assert copy_instructions[1]["args"][2] == "myuser:mygroup"


@pytest.mark.skip_debug()
def test_from_dockerfile_with_copy_chown():
    dockerfile = """FROM node:24
COPY --chown=myuser:mygroup app.js /app/
COPY --chown=anotheruser config.json /config/"""

    template = Template().from_dockerfile(dockerfile)

    instructions = template._template._instructions

    # First COPY instruction (after initial USER root and WORKDIR /)
    copy_instruction1 = instructions[2]
    assert copy_instruction1["type"] == InstructionType.COPY
    assert copy_instruction1["args"][0] == "app.js"
    assert copy_instruction1["args"][1] == "/app/"
    assert copy_instruction1["args"][2] == "myuser:mygroup"  # user from --chown

    # Second COPY instruction
    copy_instruction2 = instructions[3]
    assert copy_instruction2["type"] == InstructionType.COPY
    assert copy_instruction2["args"][0] == "config.json"
    assert copy_instruction2["args"][1] == "/config/"
    assert (
        copy_instruction2["args"][2] == "anotheruser"
    )  # user from --chown (without group)


def _instructions(template):
    return template._template._instructions


@pytest.mark.skip_debug()
def test_from_dockerfile_with_quoted_env_and_arg_values():
    dockerfile = """FROM node:24
ENV A="hello world" B='single quoted' C=plain D=escaped\\ space
ENV LEGACY some value with  spaces
ENV MULTI=1 \\
    # comment inside continuation
    LINE="two \\
words"
ARG VERSION=1.0 NAME="with space" EMPTY
ENV REF="$HOME/bin:${PATH}\""""

    template = Template().from_dockerfile(dockerfile)
    envs = [
        i["args"] for i in _instructions(template) if i["type"] == InstructionType.ENV
    ]

    assert envs == [
        ["A", "hello world", "B", "single quoted", "C", "plain", "D", "escaped space"],
        ["LEGACY", "some value with  spaces"],
        ["MULTI", "1", "LINE", "two words"],
        ["VERSION", "1.0", "NAME", "with space", "EMPTY", ""],
        ["REF", "$HOME/bin:${PATH}"],
    ]


@pytest.mark.skip_debug()
def test_from_dockerfile_with_mixed_case_keywords_and_as_alias():
    dockerfile = """from node:24 As Builder
run echo hi
Workdir /app
uSeR node"""

    template = Template().from_dockerfile(dockerfile)
    assert template._template._base_image == "node:24"
    instructions = _instructions(template)
    assert instructions[2]["type"] == InstructionType.RUN
    assert instructions[2]["args"] == ["echo hi"]
    assert instructions[3]["args"] == ["/app"]
    assert instructions[4]["args"] == ["node"]


@pytest.mark.skip_debug()
def test_from_dockerfile_preserves_whitespace_in_run_and_uses_shell_form():
    dockerfile = """FROM node:24
RUN echo "a   b"   &&   \\
    echo 'c   d'
RUN ["echo", "hello world", "it's"]"""

    template = Template().from_dockerfile(dockerfile)
    runs = [
        i["args"][0]
        for i in _instructions(template)
        if i["type"] == InstructionType.RUN
    ]

    assert runs == [
        """echo "a   b"   &&       echo 'c   d'""",
        """echo 'hello world' 'it'"'"'s'""",
    ]


@pytest.mark.skip_debug()
def test_from_dockerfile_with_escape_directive():
    dockerfile = """# escape=`
FROM node:24
RUN echo one `
    && echo two
ENV P="C:\\tools\""""

    template = Template().from_dockerfile(dockerfile)
    instructions = _instructions(template)
    assert instructions[2]["args"] == ["echo one     && echo two"]
    assert instructions[3]["args"] == ["P", "C:\\tools"]


@pytest.mark.skip_debug()
def test_from_dockerfile_with_copy_chmod_and_quoted_paths():
    dockerfile = """FROM node:24
COPY --chmod=755 --chown=app:app "my file.txt" other.txt /dest/
COPY ["json file.txt", "/dest/"]
ADD archive.tar.gz /opt/"""

    template = Template().from_dockerfile(dockerfile)
    copies = [
        i["args"] for i in _instructions(template) if i["type"] == InstructionType.COPY
    ]

    assert copies == [
        ["my file.txt", "/dest/", "app:app", "0755"],
        ["other.txt", "/dest/", "app:app", "0755"],
        ["json file.txt", "/dest/", "", ""],
        ["archive.tar.gz", "/opt/", "", ""],
    ]


@pytest.mark.skip_debug()
def test_from_dockerfile_with_heredocs():
    dockerfile = """FROM node:24
RUN <<EOF
npm install
npm run build
EOF
RUN <<-EOT
\techo tabbed
EOT
RUN python3 - <<PY
print("hi")
PY
RUN 3<<FD
touch /tmp/fd
FD
COPY <<'CONF' /etc/app.conf
key=$VALUE
CONF"""

    template = Template().from_dockerfile(dockerfile)
    runs = [
        i["args"][0]
        for i in _instructions(template)
        if i["type"] == InstructionType.RUN
    ]

    assert runs == [
        "npm install\nnpm run build\n",
        "echo tabbed\n",
        'python3 - <<PY\nprint("hi")\nPY',
        "touch /tmp/fd\n",
        """E2B_HEREDOC_DEST=/etc/app.conf\nif [ -d "$E2B_HEREDOC_DEST" ]; then E2B_HEREDOC_DEST="$E2B_HEREDOC_DEST"/CONF; fi\nmkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<'E2B_HEREDOC_CONF' >"$E2B_HEREDOC_DEST"\nkey=$VALUE\nE2B_HEREDOC_CONF""",
    ]


@pytest.mark.skip_debug()
def test_from_dockerfile_copy_heredoc_runs_as_root():
    dockerfile = """FROM node:24
USER app
COPY <<EOF /etc/app.conf
E2B_HEREDOC_EOF
x=1
EOF"""

    template = Template().from_dockerfile(dockerfile)
    runs = [
        i["args"] for i in _instructions(template) if i["type"] == InstructionType.RUN
    ]

    assert runs == [
        [
            'E2B_HEREDOC_DEST=/etc/app.conf\nif [ -d "$E2B_HEREDOC_DEST" ]; then E2B_HEREDOC_DEST="$E2B_HEREDOC_DEST"/EOF; fi\nmkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<E2B_HEREDOC_EOF_ >"$E2B_HEREDOC_DEST"\n'
            "E2B_HEREDOC_EOF\nx=1\nE2B_HEREDOC_EOF_",
            "root",
        ],
    ]


@pytest.mark.skip_debug()
def test_from_dockerfile_heredoc_terminator_avoids_the_content():
    dockerfile = """FROM node:24
COPY <<EOF /etc/app.conf
E2B_HEREDOC_EOF___ E2B_HEREDOC_EOF_
E2B_HEREDOC_EOF
EOF"""

    template = Template().from_dockerfile(dockerfile)
    runs = [
        i["args"][0]
        for i in _instructions(template)
        if i["type"] == InstructionType.RUN
    ]

    assert runs == [
        'E2B_HEREDOC_DEST=/etc/app.conf\nif [ -d "$E2B_HEREDOC_DEST" ]; then E2B_HEREDOC_DEST="$E2B_HEREDOC_DEST"/EOF; fi\nmkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<E2B_HEREDOC_EOF____ >"$E2B_HEREDOC_DEST"\n'
        "E2B_HEREDOC_EOF___ E2B_HEREDOC_EOF_\nE2B_HEREDOC_EOF\nE2B_HEREDOC_EOF____",
    ]


@pytest.mark.skip_debug()
def test_from_dockerfile_copy_heredoc_keeps_docker_substitution_patterns():
    dockerfile = """FROM node:24
COPY <<EOF /etc/app.conf
${X/old/new} ${X//o/0} ${X/a\\/b/c} ${X/`/x} ${Y#\\*} ${Y%%\\}} ${Z:-foo\\}bar} ${Z:-a\\\\b}
EOF"""

    template = Template().from_dockerfile(dockerfile)
    runs = [
        i["args"][0]
        for i in _instructions(template)
        if i["type"] == InstructionType.RUN
    ]

    assert runs == [
        "E2B_HEREDOC_DEST=/etc/app.conf\n"
        'if [ -d "$E2B_HEREDOC_DEST" ]; then E2B_HEREDOC_DEST="$E2B_HEREDOC_DEST"/EOF; fi\n'
        'mkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<E2B_HEREDOC_EOF >"$E2B_HEREDOC_DEST"\n'
        "${X/old/new} ${X//o/0} ${X/a\\/b/c} ${X/\\`/x} ${Y#\\*} ${Y%%\\}} ${Z:-foo\\}bar} ${Z:-a\\\\b}\nE2B_HEREDOC_EOF",
    ]


@pytest.mark.skip_debug()
def test_from_dockerfile_copy_chmod_resolves_arg_and_env_values():
    dockerfile = """FROM node:24
ARG MODE=440
ENV FULL=0${MODE}
COPY --chmod=$MODE a /a
COPY --chmod=${FULL} b /b
COPY --chmod=${UNSET:-755} c /c"""

    template = Template().from_dockerfile(dockerfile)
    copies = [
        i["args"] for i in _instructions(template) if i["type"] == InstructionType.COPY
    ]

    assert copies == [
        ["a", "/a", "", "0440"],
        ["b", "/b", "", "0440"],
        ["c", "/c", "", "0755"],
    ]


@pytest.mark.skip_debug()
def test_from_dockerfile_copy_heredoc_with_shell_unsafe_name():
    dockerfile = """FROM node:24
COPY <<FOO;BAR /etc/
hi
FOO;BAR"""

    template = Template().from_dockerfile(dockerfile)
    runs = [
        i["args"][0]
        for i in _instructions(template)
        if i["type"] == InstructionType.RUN
    ]

    assert runs == [
        "E2B_HEREDOC_DEST='/etc/FOO;BAR'\n"
        'mkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<E2B_HEREDOC_FOO_BAR >"$E2B_HEREDOC_DEST"\n'
        "hi\nE2B_HEREDOC_FOO_BAR",
    ]


@pytest.mark.skip_debug()
def test_from_dockerfile_copy_heredoc_into_directory_expands_only_variables():
    dockerfile = """FROM node:24
COPY <<EOF /etc/
run `npm start` and $(id) for $USER, \\$(literal) and ${HOME:-$(x)}
EOF
COPY <<EOF .
x
EOF"""

    template = Template().from_dockerfile(dockerfile)
    runs = [
        i["args"][0]
        for i in _instructions(template)
        if i["type"] == InstructionType.RUN
    ]

    assert runs == [
        "E2B_HEREDOC_DEST=/etc/EOF\n"
        'mkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<E2B_HEREDOC_EOF >"$E2B_HEREDOC_DEST"\n'
        "run \\`npm start\\` and \\$(id) for $USER, \\$(literal) and ${HOME:-\\$(x)}\nE2B_HEREDOC_EOF",
        "E2B_HEREDOC_DEST=.\n"
        'if [ -d "$E2B_HEREDOC_DEST" ]; then E2B_HEREDOC_DEST="$E2B_HEREDOC_DEST"/EOF; fi\n'
        'mkdir -p "$(dirname "$E2B_HEREDOC_DEST")" && cat <<E2B_HEREDOC_EOF >"$E2B_HEREDOC_DEST"\n'
        "x\nE2B_HEREDOC_EOF",
    ]


@pytest.mark.skip_debug()
def test_from_dockerfile_copy_with_literal_paths_and_zero_mode():
    dockerfile = """FROM node:24
COPY "<<EOF" /tmp/
COPY --chmod=000 secret.txt /tmp/"""

    template = Template().from_dockerfile(dockerfile)
    copies = [
        i["args"] for i in _instructions(template) if i["type"] == InstructionType.COPY
    ]

    assert copies == [
        ["<<EOF", "/tmp/", "", ""],
        ["secret.txt", "/tmp/", "", "0000"],
    ]


@pytest.mark.skip_debug()
def test_from_dockerfile_combines_entrypoint_and_cmd():
    cases = [
        (
            'ENTRYPOINT ["npm", "run"]\nCMD ["start", "--port 80"]',
            "npm run start '--port 80'",
        ),
        ('ENTRYPOINT ["npm"]\nCMD run start', "npm /bin/sh -c 'run start'"),
        ('ENTRYPOINT npm start\nCMD ["ignored"]', "npm start"),
        ("CMD npm start", "npm start"),
        ('CMD ["npm", "start"]', "npm start"),
        ("", None),
        ("CMD", None),
        ("ENTRYPOINT", None),
    ]
    for tail, expected in cases:
        template = Template().from_dockerfile(f"FROM node:24\n{tail}")
        assert template._template._start_cmd == expected, tail


@pytest.mark.skip_debug()
def test_from_dockerfile_ignores_metadata_instructions_and_flags():
    dockerfile = """FROM --platform=linux/amd64 node:24
EXPOSE 80 443
VOLUME ["/data"]
LABEL maintainer="me"
STOPSIGNAL SIGTERM
HEALTHCHECK NONE
RUN --mount=type=cache,target=/root/.npm npm ci"""

    template = Template().from_dockerfile(dockerfile)
    instructions = _instructions(template)
    assert instructions[2]["type"] == InstructionType.RUN
    assert instructions[2]["args"] == ["npm ci"]


@pytest.mark.skip_debug()
def test_from_dockerfile_rejects_invalid_dockerfiles():
    cases = [
        ("", "must contain a FROM"),
        ("RUN echo hi", "must contain a FROM"),
        ("FROM a\nFROM b", "Multi-stage"),
        ("FROM a\nRUN <<EOF\nnever closed", "unterminated heredoc"),
        ("FROM a\nCOPY <<EOF /x\n${}\nEOF", "bad substitution"),
        ("FROM a\nCOPY <<EOF /x\n${HOME:-\nEOF", "missing '}'"),
        ("FROM a\nCOPY <<EOF /x\n${X/a\nEOF", r"missing '/' in \$\{\}"),
        ("FROM a\nCOPY <<EOF /x\n${X:/a/b}\nEOF", r"unsupported modifier \(:/\)"),
        (
            "FROM a\nCOPY --chmod=$NOPE a b",
            r'invalid chmod value "\$NOPE" \(resolves to ""\)',
        ),
        (
            "FROM a\nCOPY <<EOF /x\n" + "${A:-" * 5000 + "}" * 5000 + "\nEOF",
            "recursion",
        ),
        ("FROM a\nBOGUS instruction", "unknown instruction: BOGUS"),
        ("FROM a\nCOPY --unknown=1 a b", "unknown flag: unknown"),
        ("FROM a\nCOPY --from=builder a b", "--from is not supported"),
        ("FROM a\nCOPY --toString=1 a b", "unknown flag: toString"),
        ('FROM a\nENV K="unterminated', "looking for matching double-quote"),
        ('FROM a\nRUN ["not", 1]', "Only strings are supported"),
    ]
    for dockerfile, expected in cases:
        with pytest.raises(DockerfileSyntaxError, match=expected):
            Template().from_dockerfile(dockerfile)
