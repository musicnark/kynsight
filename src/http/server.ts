import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AssessmentService } from "../assessment/service.js";

const MAX_REQUEST_BODY_BYTES = 1_000_000;

export interface KynSightServerOptions {
  assessmentService: AssessmentService;
}

export function createKynSightServer(options: KynSightServerOptions): Server {
  return createServer(async (request, response) => {
    try {
      await handleRequest(request, response, options.assessmentService);
    } catch {
      writeJson(response, 500, {
        status: "ERROR",
        partial: false,
        assessmentError: {
          code: "INTERNAL_ERROR",
          message: "KynSight could not complete the request.",
          retryable: false,
        },
      });
    }
  });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  assessmentService: AssessmentService,
): Promise<void> {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

  if (request.method === "GET" && pathname === "/") {
    writeJson(response, 200, { name: "KynSight", status: "ok" });
    return;
  }

  if (request.method === "POST" && pathname === "/assessments") {
    const body = await readJsonBody(request);
    if (!body.ok) {
      writeJson(response, 400, {
        status: "ERROR",
        partial: false,
        assessmentError: {
          code: "INVALID_REQUEST",
          message: body.message,
          retryable: false,
        },
      });
      return;
    }

    const result = await assessmentService.request(body.value);
    writeJson(response, result.statusCode, result.body, result.headers);
    return;
  }

  writeJson(response, 404, {
    status: "ERROR",
    partial: false,
    assessmentError: {
      code: "NOT_FOUND",
      message: "The requested KynSight route was not found.",
      retryable: false,
    },
  });
}

function readJsonBody(
  request: IncomingMessage,
): Promise<{ ok: true; value: unknown } | { ok: false; message: string }> {
  return new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];
    let settled = false;

    const fail = (message: string): void => {
      if (!settled) {
        settled = true;
        resolve({ ok: false, message });
      }
    };

    request.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > MAX_REQUEST_BODY_BYTES) {
        request.resume();
        fail("The request body is too large.");
        return;
      }
      chunks.push(buffer);
    });
    request.on("error", () => fail("The request body could not be read."));
    request.on("end", () => {
      if (settled) {
        return;
      }

      try {
        const value = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
        settled = true;
        resolve({ ok: true, value });
      } catch {
        fail("The request body must contain valid JSON.");
      }
    });
  });
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    ...headers,
  });
  response.end(JSON.stringify(body));
}
