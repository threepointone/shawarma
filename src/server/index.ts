import { createOpenAI } from "@ai-sdk/openai";
import { Agent, runSwarm } from "@ai-sdk/swarm";
import { CoreMessage } from "ai";
import { z } from "zod";
import {
  Connection,
  ConnectionContext,
  Server,
  WSMessage,
  routePartykitRequest,
} from "partyserver";

// @ts-ignore
import WorldSeriesText from "./2024-world-series.txt";

// @ts-ignore
declare const WorldSeriesText: string;

type Context = { text: string; speechType?: string; targetLanguage?: string };

export type Message =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "input";
      text: string;
    };

type Env = {
  MyAgent: DurableObjectNamespace<MyAgent>;
  OPENAI_API_KEY: string;
};

export class MyAgent extends Server<Env> {
  messages: CoreMessage[] = [];
  text: string = WorldSeriesText;
  state: "waiting" | "doing" = "waiting";

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  translator = new Agent<Context>({
    name: "Translator",
    system: ({ text, targetLanguage }) =>
      `Translate the following text to ${targetLanguage}:\n\n${text}`,
  });

  manager = new Agent<Context>({
    name: "Manager",
    system: "You transfer conversations to the appropriate agent.",
    tools: {
      transferToTranslator: {
        type: "handover",
        parameters: z.object({
          targetLanguage: z.string(),
        }),
        execute: ({ targetLanguage }, { context }) => ({
          agent: this.translator,
          context: { targetLanguage, text: context.text },
        }),
      },
      transferToSummarizer: {
        type: "handover",
        parameters: z.object({}),
        execute: () => ({
          agent: this.summarizer,
        }),
      },
      transferToRewriter: {
        type: "handover",
        parameters: z.object({}),
        execute: () => ({
          agent: this.rewriter,
        }),
      },
    },
  });

  summarizer = new Agent<Context>({
    name: "Summarizer",
    system: ({ text }) => `Summarize the following text :\n\n${text}`,
  });

  rewriter = new Agent<Context>({
    name: "Rewriter",
    system: ({ text, speechType }) =>
      `Rewrite the following text in ${speechType}:\n\n${text}`,
  });

  onConnect(
    connection: Connection,
    ctx: ConnectionContext
  ): void | Promise<void> {
    connection.send(
      JSON.stringify({
        type: "text",
        text: this.text,
      })
    );
  }

  async onMessage(connection: Connection, message: WSMessage) {
    const data = JSON.parse(message as string);

    if (data.type === "input") {
      if (this.state === "waiting") {
        // this.text = data.text;
        this.state = "doing";
        await this.step(data.text);
        this.state = "waiting";
      } else {
        console.warn("Already doing something");
      }
    }
  }
  async step(input: string) {
    const openai = createOpenAI({
      apiKey: this.env.OPENAI_API_KEY,
    });

    const { text: updatedText, responseMessages } = await runSwarm({
      agent: this.manager,
      context: { text: this.text },
      model: openai("gpt-4o", { structuredOutputs: true }),
      prompt: [{ role: "user", content: input }],
      debug: true,
    });

    this.messages.push(...responseMessages);
    this.text = updatedText;

    console.log();
    console.log(this.text);
    console.log();
    this.broadcast(
      JSON.stringify({
        type: "text",
        text: this.text,
      })
    );
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return (
      (await routePartykitRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
