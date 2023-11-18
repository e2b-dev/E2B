"use client";

import clsx from "clsx";
import { useAccessToken, useApiKey, useUser } from "@/utils/useUser";
import { usePostHog } from "posthog-js/react";
import { useSignIn } from "@/utils/useSignIn";
import { obfuscateSecret } from "@/utils/obfuscate";
import { Button } from "@/components/Button";
import { CopyButton } from "@/components/CopyButton";
import { Note } from '@/components/mdx'

export function CopyableSecret({
  secret,
  onAfterCopy,
  obfuscateStart,
  obfuscateEnd,
}: {
  secret: string;
  onAfterCopy: () => void;
  obfuscateStart?: number;
  obfuscateEnd?: number;
}) {
  return (
    <div className="relative flex">
      <span className="whitespace-nowrap font-mono text-yellow-400 group-hover:opacity-0">
        {obfuscateSecret(secret, obfuscateStart, obfuscateEnd)}
      </span>
      <span className="absolute inset-0">
        <CopyButton
          code={secret}
          onAfterCopy={onAfterCopy}
          customPositionClassNames={clsx(
            "top-[-2px] bottom-[2px]" /* nudge 2px up*/,
            "left-[-8px] right-[-8px]" /* widen a little to fit nicely */,
            "min-h-[28px]"
          )}
        />
      </span>
    </div>
  );
}

function SecretBlock({ name, description, secret, posthog, tip }) {
  return (
    <div className="flex flex-col space-y-1">
      <h2 className="flex flex-row items-center justify-items-end align-text-bottom mt-6">
        <span>{name}</span>
        <div className="group text-sm ml-4 border-2 mt-1 outline-2 outline-offset-2 outline-zinc-700 rounded-full px-[8px]">
          <CopyableSecret
            secret={secret}
            onAfterCopy={() => posthog?.capture("copied API key")}
            obfuscateStart={12}
            obfuscateEnd={5}
          />
        </div>
      </h2>
      <span>{description}</span>
      <span>{tip}</span>
    </div>
  );
}

function APIKey() {
  const signIn = useSignIn();
  const { user } = useUser();
  const apiKey = useApiKey();
  const posthog = usePostHog();
  const accessToken = useAccessToken();

  return (
    <div className="flex flex-col items-start justify-start -mb-6">
      {user ? (
        <div className="flex flex-col space-y-4">
          <SecretBlock
            name="API Key"
            description={
              <span>
                Use for <strong>running</strong> the sandboxes.
              </span>
            }
            secret={apiKey}
            posthog={posthog}
            tip={
              <span>
                Set as <code>E2B_API_KEY</code> environment variable to avoid passing it
                every time.
              </span>
            }
          />
          <SecretBlock
            name="Access Token"
            description={
              <div className="flex flex-col">
                <span>
                  Use for <strong>managing</strong> the sandboxes
                  (creating/listing/deleting).
                </span>
                <span>
                  Not needed when logging in CLI via <code>e2b login</code>.
                </span>
              </div>
            }
            secret={accessToken}
            posthog={posthog}
            tip={
              <Note>
                <div className="flex flex-col">
                  <span>To authenticate without the browser, you can set <code>E2B_ACCESS_TOKEN</code> as an environment variable.</span>
                  <span>This can be useful for CI/CD pipelines.</span>
                </div>
              </Note>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col items-start justiy-start gap-4 mt-6">
          <span>You can get your API key by signing up.</span>
          <Button onClick={() => signIn()}>Sign up to get your API key</Button>
        </div>
      )}
    </div>
  );
}

export default APIKey;
