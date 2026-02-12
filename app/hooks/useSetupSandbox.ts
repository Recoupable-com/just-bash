import { useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { RECOUP_API_URL } from "@/lib/consts";

export function useSetupSandbox() {
  const { authenticated, getAccessToken } = usePrivy();
  const hasRun = useRef(false);

  useEffect(() => {
    if (!authenticated || hasRun.current) return;
    hasRun.current = true;

    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;

        const headers = { Authorization: `Bearer ${token}` };

        const res = await fetch(`${RECOUP_API_URL}/api/sandboxes`, { headers });
        if (!res.ok) return;

        const data = await res.json();
        if (data.snapshot_id && data.github_repo) return;

        fetch(`${RECOUP_API_URL}/api/sandboxes/setup`, {
          method: "POST",
          headers,
        });
      } catch {
        // Silent — background provisioning only
      }
    })();
  }, [authenticated, getAccessToken]);
}
