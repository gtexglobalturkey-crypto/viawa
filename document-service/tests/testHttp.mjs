import { PassThrough } from "node:stream";

export function request({ method = "GET", url = "/", headers = {}, body = "" } = {}) {
  const stream = new PassThrough();
  stream.method = method;
  stream.url = url;
  stream.headers = headers;
  stream.end(body);
  return stream;
}

export function response() {
  let resolve;
  const done = new Promise((value) => { resolve = value; });
  const headers = new Map();
  return {
    statusCode: 200, headersSent: false,
    setHeader(name, value) { headers.set(name.toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
    end(value = Buffer.alloc(0)) { this.headersSent = true; this.body = Buffer.from(value); resolve(this); },
    done,
  };
}

export const environment = {
  nodeEnv: "test", host: "127.0.0.1", port: 8080,
  supabaseUrl: "https://project.example", supabaseAnonKey: "anon", supabaseServiceRoleKey: "service",
  documentTemplatePath: "/template.docx", documentTempRoot: "/tmp/documents", logLevel: "error",
  corsAllowedOrigins: ["https://app.example"], httpRequestBodyLimitBytes: 128,
};

export function endpoint(overrides = {}) {
  return {
    authenticate: async () => ({ id: "user" }), authorize: async () => ({ allowed: true }),
    generate: async () => ({ result: { success: true, outputFileName: "Contract.docx", warnings: [], validationErrors: [] }, docxBuffer: Buffer.from("docx") }),
    ...overrides,
  };
}
