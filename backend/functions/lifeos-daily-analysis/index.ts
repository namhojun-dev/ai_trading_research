const jsonHeaders = { "content-type": "application/json" };

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  env: {
    get(key: string): string | undefined;
  };
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const appBaseUrl = Deno.env.get("LIFEOS_APP_BASE_URL");
  const cronSecret = Deno.env.get("LIFEOS_CRON_SECRET");

  if (!appBaseUrl || !cronSecret) {
    return new Response(
      JSON.stringify({
        error: "LIFEOS_APP_BASE_URL and LIFEOS_CRON_SECRET are required",
      }),
      { status: 501, headers: jsonHeaders },
    );
  }

  const response = await fetch(`${appBaseUrl.replace(/\/$/, "")}/api/jobs/lifeos-daily-analysis`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-lifeos-cron-secret": cronSecret,
    },
    body: await req.text(),
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: jsonHeaders,
  });
});
