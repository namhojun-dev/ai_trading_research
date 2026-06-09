const url = process.env.CODEX_APP_SERVER_URL ?? "ws://127.0.0.1:14567";
const featureName = process.env.CODEX_REMOTE_FEATURE ?? "remote_control";

let nextId = 1;
const pending = new Map();
const notifications = [];

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (/token|secret|auth|credential|bearer/i.test(key)) {
        out[key] = "[redacted]";
      } else {
        out[key] = sanitize(child);
      }
    }
    return out;
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error("WebSocket connect timeout")), 10000);

    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("WebSocket connection failed"));
    });
  });
}

function attach(ws) {
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(sanitize(message.error))));
      else resolve(message.result);
      return;
    }

    if (message.method) {
      notifications.push(sanitize(message));
    }
  });
}

function request(ws, method, params) {
  const id = nextId++;
  const payload = { jsonrpc: "2.0", id, method };
  if (params !== undefined) payload.params = params;
  ws.send(JSON.stringify(payload));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, 30000);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
  });
}

async function requestWithFallback(ws, method, candidates) {
  const errors = [];
  for (const params of candidates) {
    try {
      return await request(ws, method, params);
    } catch (error) {
      errors.push(error.message);
    }
  }
  throw new Error(`${method} failed: ${errors.join(" | ")}`);
}

function summarizeStatus(status) {
  if (!status || typeof status !== "object") return status;
  return {
    status: status.status,
    serverName: status.serverName,
    installationIdPresent: Boolean(status.installationId),
    environmentIdPresent: Boolean(status.environmentId),
  };
}

const ws = await connect();
attach(ws);

try {
  const init = await request(ws, "initialize", {
    clientInfo: {
      name: "codex-remote-control-helper",
      title: "Codex Remote Control Helper",
      version: "1.0.0",
    },
    capabilities: {
      experimentalApi: true,
      requestAttestation: false,
      optOutNotificationMethods: [],
    },
  });

  const featureList = await request(ws, "experimentalFeature/list", {
    limit: 100,
    cursor: null,
    threadId: null,
  });
  const remoteFeature = featureList?.data?.find((feature) => feature.name === featureName);

  const setResult = await request(ws, "experimentalFeature/enablement/set", {
    enablement: { [featureName]: true },
  });

  const enableResult = await requestWithFallback(ws, "remoteControl/enable", [undefined, {}]);

  let status = await requestWithFallback(ws, "remoteControl/status/read", [undefined, {}]);
  for (let i = 0; i < 20 && status?.status !== "connected"; i += 1) {
    await sleep(1000);
    status = await requestWithFallback(ws, "remoteControl/status/read", [undefined, {}]);
  }

  const summary = {
    initialized: {
      userAgent: init?.userAgent,
      platformFamily: init?.platformFamily,
      platformOs: init?.platformOs,
      codexHomePresent: Boolean(init?.codexHome),
    },
    feature: remoteFeature
      ? {
          name: remoteFeature.name,
          stage: remoteFeature.stage,
          enabledBeforeRuntimeSet: remoteFeature.enabled,
          defaultEnabled: remoteFeature.defaultEnabled,
        }
      : { name: featureName, listed: false },
    runtimeEnablementSet: Boolean(setResult),
    remoteControlEnableReturned: enableResult === null || typeof enableResult === "object",
    status: summarizeStatus(status),
    recentRemoteNotifications: notifications
      .filter((message) => String(message.method).includes("remoteControl"))
      .slice(-5)
      .map((message) => ({ method: message.method, params: summarizeStatus(message.params) })),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (status?.status !== "connected") {
    process.exitCode = 2;
  }
} finally {
  ws.close();
}
