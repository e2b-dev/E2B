import {
  OutStderrResponse,
  OutStdoutResponse,
  ProcessManager,
  createSessionProcess
} from '@devbookhq/sdk';

export async function readFileAsBase64(manager: ProcessManager, filepath: string) {
  const stderr: OutStderrResponse[] = [];
  const stdout: OutStdoutResponse[] = [];

  const process = await createSessionProcess({
    manager,
    onStderr: (o) => stderr.push(o),
    onStdout: (o) => stdout.push(o),
    cmd: `base64 -w 0 ${filepath}`,
  });

  await process.exited;

  if (stderr.length > 0) {
    throw new Error(`Error reading file ${stderr.map(o => o.line).join('\n')}`);
  }

  return stdout.map(o => o.line).join('');
}
