import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { forwardRequest } from "../src/proxy/forwarder.js";
import type { AuliteConfig } from "../src/config/types.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeConfig(provider: "openai" | "anthropic"): AuliteConfig {
  return {
    server: { port: 3000, host: "0.0.0.0" },
    provider: {
      default: provider,
      openai: { baseUrl: "https://api.openai.com", apiKey: "sk-test" },
      anthropic: { baseUrl: "https://api.anthropic.com", apiKey: "sk-ant-test" },
    },
    analysis: {
      mode: "advisory",
      domains: ["hr"],
      llmJudge: { enabled: false, model: "claude-sonnet-4-6", sampleRate: 0.1 },
      thresholds: { warn: 4, block: 7 },
    },
    logging: { database: ":memory:", retentionDays: 365 },
  };
}

describe("forwardRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards to OpenAI with correct URL and auth", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('{"choices":[]}', { status: 200 }),
    );

    const result = await forwardRequest(
      '{"model":"gpt-4","messages":[{"role":"user","content":"hi"}]}',
      new Headers({ "content-type": "application/json" }),
      makeConfig("openai"),
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(opts.headers["Authorization"]).toBe("Bearer sk-test");
    expect(result.statusCode).toBe(200);
    expect(result.provider).toBe("openai");
  });

  it("forwards to Anthropic with correct URL, auth, and transformed body", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "msg_123",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "Hello!" }],
          model: "claude-sonnet-4-6",
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
        { status: 200 },
      ),
    );

    const result = await forwardRequest(
      JSON.stringify({
        model: "claude-sonnet-4-6",
        messages: [
          { role: "system", content: "Be helpful" },
          { role: "user", content: "hi" },
        ],
      }),
      new Headers({ "content-type": "application/json" }),
      makeConfig("anthropic"),
    );

    // Check request was transformed
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(opts.headers["x-api-key"]).toBe("sk-ant-test");
    expect(opts.headers["anthropic-version"]).toBe("2023-06-01");

    const sentBody = JSON.parse(opts.body);
    expect(sentBody.system).toBe("Be helpful");
    expect(sentBody.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(sentBody.stream).toBe(false);

    // Check response was transformed to OpenAI format
    const openaiResponse = JSON.parse(result.responseBody);
    expect(openaiResponse.object).toBe("chat.completion");
    expect(openaiResponse.choices).toHaveLength(1);
    expect(openaiResponse.choices[0].message.role).toBe("assistant");
    expect(openaiResponse.choices[0].message.content).toBe("Hello!");
    expect(openaiResponse.choices[0].finish_reason).toBe("stop");
    expect(openaiResponse.usage.prompt_tokens).toBe(10);
    expect(openaiResponse.usage.completion_tokens).toBe(5);
    expect(openaiResponse.usage.total_tokens).toBe(15);
  });

  it("passes through Anthropic error responses without transformation", async () => {
    const errorBody = JSON.stringify({
      type: "error",
      error: { type: "invalid_request_error", message: "Bad request" },
    });
    mockFetch.mockResolvedValueOnce(new Response(errorBody, { status: 400 }));

    const result = await forwardRequest(
      '{"model":"claude-sonnet-4-6","messages":[{"role":"user","content":"hi"}]}',
      new Headers({ "content-type": "application/json" }),
      makeConfig("anthropic"),
    );

    expect(result.statusCode).toBe(400);
    // Error responses should NOT be transformed
    const parsed = JSON.parse(result.responseBody);
    expect(parsed.type).toBe("error");
    expect(parsed.error.type).toBe("invalid_request_error");
  });

  it("throws when provider is not configured", async () => {
    const config = makeConfig("openai");
    config.provider.openai = undefined;

    await expect(
      forwardRequest(
        '{"model":"gpt-4","messages":[]}',
        new Headers(),
        config,
      ),
    ).rejects.toThrow("No provider configured");
  });

  it("maps Anthropic stop_reason correctly", async () => {
    for (const [anthropicReason, openaiReason] of [
      ["end_turn", "stop"],
      ["max_tokens", "length"],
      ["stop_sequence", "stop"],
      ["tool_use", "tool_calls"],
    ]) {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "msg_1",
            content: [{ type: "text", text: "x" }],
            stop_reason: anthropicReason,
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
          { status: 200 },
        ),
      );

      const result = await forwardRequest(
        '{"model":"claude-sonnet-4-6","messages":[{"role":"user","content":"x"}]}',
        new Headers({ "content-type": "application/json" }),
        makeConfig("anthropic"),
      );

      const parsed = JSON.parse(result.responseBody);
      expect(parsed.choices[0].finish_reason).toBe(openaiReason);
    }
  });
});
