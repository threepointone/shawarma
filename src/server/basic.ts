import { createOpenAI } from "@ai-sdk/openai";
import { Agent, runSwarm } from "@ai-sdk/swarm";

import { z } from "zod";
import { Server, getServerByName } from "partyserver";

type Env = {
  MyAgent: DurableObjectNamespace<MyAgent>;
  OPENAI_API_KEY: string;
};

export class MyAgent extends Server<Env> {
  state = {
    running: false,
    text: "running...",
  };
  async onStart() {
    this.run();
  }
  async run() {
    const openai = createOpenAI({
      apiKey: this.env.OPENAI_API_KEY,
    });

    if (this.state.running) {
      return;
    }
    console.log("running");
    this.state.running = true;
    const agentA = new Agent({
      name: "Agent A",
      system: "You are a helpful agent.",
      tools: {
        transferToAgentB: {
          type: "handover",
          parameters: z.object({}),
          execute: () => ({ agent: agentB }),
        },
      },
    });

    const agentB = new Agent({
      name: "Agent B",
      system: "Only speak in Haikus.",
    });

    try {
      const { text } = await runSwarm({
        agent: agentA,
        context: {},
        model: openai("gpt-4o", { structuredOutputs: true }),
        prompt: "I want to talk to agent B.",
        debug: true,
        onStepFinish: (result) => {
          console.log({ result });
        },
      });
      console.log("got here");

      this.state.text = text;
    } catch (e) {
      console.error(e);
    }
  }
  async onRequest(request: Request) {
    return new Response(this.state.text);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const stub = await getServerByName(env.MyAgent, "some-server");
    return stub.fetch(request);
  },
};
