## @threepointone/shawarma

(just an evening spike, ignore)

[openai's swarm](https://github.com/openai/swarm), [rewritten by vercel's ai sdk team](https://github.com/vercel/ai/tree/main/examples/swarm), running on workers/durable objects.

```ts
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
```
