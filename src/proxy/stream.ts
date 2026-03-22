import type { AuliteConfig } from "../config/types.js";
import { buildUpstreamRequest } from "./provider.js";
import { logger } from "../utils/logger.js";

export interface StreamForwardResult {
  stream: ReadableStream<Uint8Array>;
  provider: string;
  model: string | null;
  contentPromise: Promise<string>;
}

export async function forwardStreamingRequest(
  requestBody: string,
  _headers: Headers,
  config: AuliteConfig,
): Promise<StreamForwardResult> {
  const upstream = buildUpstreamRequest(requestBody, config, true);

  logger.debug("Streaming request", { provider: upstream.provider, model: upstream.model });

  const response = await fetch(upstream.url, {
    method: "POST",
    headers: upstream.headers,
    body: upstream.body,
  });

  if (!response.ok || !response.body) {
    const text = await response.text();
    throw new Error(`Upstream error ${response.status}: ${text}`);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const needsTransform = upstream.format === "anthropic";

  let accumulatedContent = "";
  let resolveContent: (content: string) => void;
  const contentPromise = new Promise<string>((resolve) => { resolveContent = resolve; });
  let messageId = `chatcmpl-${Date.now()}`;

  const transformedStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = response.body!.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            if (!event.trim()) continue;

            if (needsTransform) {
              const result = transformAnthropicEvent(event, messageId, upstream.model);
              if (result.output) controller.enqueue(encoder.encode(result.output));
              if (result.text) accumulatedContent += result.text;
              if (result.id) messageId = result.id;
            } else {
              controller.enqueue(encoder.encode(event + "\n\n"));
              const text = extractContent(event);
              if (text) accumulatedContent += text;
            }
          }
        }

        if (needsTransform) controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        resolveContent!(accumulatedContent);
      } catch (err) {
        controller.error(err);
        resolveContent!(accumulatedContent);
      }
    },
  });

  return {
    stream: transformedStream,
    provider: upstream.provider,
    model: upstream.model,
    contentPromise,
  };
}

function transformAnthropicEvent(
  event: string,
  messageId: string,
  model: string | null,
): { output?: string; text?: string; id?: string } {
  let eventType = "";
  let data = "";

  for (const line of event.split("\n")) {
    if (line.startsWith("event: ")) eventType = line.slice(7).trim();
    else if (line.startsWith("data: ")) data = line.slice(6);
  }

  if (!data) return {};

  try {
    const parsed = JSON.parse(data);

    switch (eventType) {
      case "message_start": {
        const id = parsed.message?.id ?? messageId;
        return { output: sseChunk(id, model, { role: "assistant" }, null), id };
      }
      case "content_block_delta": {
        const text = parsed.delta?.text ?? "";
        if (!text) return {};
        return { output: sseChunk(messageId, model, { content: text }, null), text };
      }
      case "message_delta": {
        const stopMap: Record<string, string> = { end_turn: "stop", max_tokens: "length", stop_sequence: "stop" };
        return { output: sseChunk(messageId, model, {}, stopMap[parsed.delta?.stop_reason] ?? "stop") };
      }
      default:
        return {};
    }
  } catch {
    return {};
  }
}

function sseChunk(id: string, model: string | null, delta: Record<string, string>, finishReason: string | null): string {
  return `data: ${JSON.stringify({
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: model ?? "unknown",
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  })}\n\n`;
}

function extractContent(event: string): string | null {
  for (const line of event.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6);
    if (data === "[DONE]") return null;
    try { return JSON.parse(data).choices?.[0]?.delta?.content ?? null; } catch { return null; }
  }
  return null;
}
