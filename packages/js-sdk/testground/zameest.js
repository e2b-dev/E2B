// eslint-disable-next-line @typescript-eslint/no-var-requires
const e2b = require("../dist/index");

function enhance(sandbox) {
  sandbox.fs = sandbox.filesystem; // alias, for convenience & consistency with stdlib

  sandbox.process._run = async function (cmd, opts) {
    const cmdSlug = cmd.substring(0, 20); // keep it short for nicer logs
    const proc = await this.start({
      cmd,
      ...opts,
      onStdout: ({ line }) => console.log(`[🔹 ${cmdSlug}]`, line),
      onStderr: ({ line }) => console.log(`[🔸 ${cmdSlug}]`, line)
    });
    await proc.finished;
    return proc.output.stdout.trim();
  };

  sandbox.process._cloneRepo = async function (repo, dir = "") {
    const cmd = `git clone --depth 1 ${repo} ${dir}`;
    await this._run(cmd);
  };

  sandbox._keepAlive = async function () {
    const interval = setInterval(async () => {
      try {
        await this.process._run('echo "♥"');
      } catch (err) {
        console.error("Keepalive failed:", err);
        clearInterval(interval);
      }
    }, 1000 * 10);
  };
}

const printedPorts = [];

function printNewPortAndURL(openPorts, sandbox) {
  openPorts.forEach((port) => {
    if (!printedPorts.includes(port.port)) {
      printedPorts.push(port.port);
      console.log(port, `https://${sandbox.getHostname(port.port)}`);
    }
  });
}

async function main() {
  const sandbox = await e2b.Sandbox.create({
    id: "Nodejs",
    apiKey: process.env.E2B_API_KEY
    // onScanPorts: openPorts => printNewPortAndURL(openPorts, sandbox),
  });
  enhance(sandbox);

  sandbox._keepAlive();

  console.log("Cloning repo...");
  await sandbox.process._cloneRepo("https://github.com/Strajk/demo-todos");
  console.log("Repo cloned.");

  // install deps
  console.log("Installing deps...");
  await sandbox.process._run("npm i");
  console.log("Deps installed.");

  // log deps
  console.log("Listing deps...");
  const deps = await sandbox.process._run("npm ls --depth=0");
  console.log("Deps:", deps);

  // run tests
  console.log("Running tests...");
  await sandbox.process._run("npm test");
  console.log("Tests finished.");

  // wait for 5m
  console.log("Waiting for 5m...");

  await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 5));

  await sandbox.close();
}

main().catch(console.error);
