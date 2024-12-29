import { WorkerEntrypoint } from "cloudflare:workers";

export class UtilsWorker extends WorkerEntrypoint {
  // Currently, entrypoints without a named handler are not supported
  async fetch() { return new Response(null, {status: 404}); } 

  async generateID(length=50) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
  }

  async readRequestBody(request) {
    const contentType = request.headers.get("content-type");
    if (contentType.includes("application/json")) {
      return JSON.stringify(await request.json());
    } else if (contentType.includes("application/text")) {
      return request.text();
    } else if (contentType.includes("text/html")) {
      return request.text();
    } else if (contentType.includes("form")) {
      const formData = await request.formData();
      const body = {};
      for (const entry of formData.entries()) {
        body[entry[0]] = entry[1];
      }
      return JSON.stringify(body);
    } else {
      return "[File]";
    }
  }
}

export default {
  // Currently, entrypoints without a named handler are not supported
  async fetch(request) { return new Response(null, {status: 404}); }
}