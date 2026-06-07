import { Think } from "@cloudflare/think";
import { createWorkersAI } from "workers-ai-provider";
import { tool } from "ai";
import { z } from "zod";

export class PortfolioThinkAgent extends Think<Env> {
  getModel() {
    return createWorkersAI({ binding: this.env.AI })(
      "@cf/meta/llama-3.1-8b-instruct",
    );
  }

  getSystemPrompt() {
    return `You are the AI assistant for pecunies.com — the terminal portfolio of Chris Pecunies, a Seattle-based Software Engineer.

You help visitors:
- Explore portfolio content (projects, skills, experience, posts)
- Answer technical questions about Chris's work
- Suggest terminal commands to navigate the site
- Provide concise, factual, portfolio-grounded answers

Keep responses short and practical. If you don't know something from the context, say so.

Key projects:
- Marketplace Aggregator on AWS (moe.pecunies.com)
- WebAssembly Runtime in Zig (github.com/clpi/wart)
- Raspberry Pi Infrastructure Cluster
- down.nvim (github.com/clpi/down.nvim)

Contact: chris@pecunies.com`;
  }

  getTools() {
    return {
      getWeather: tool({
        description: "Get current weather for a location",
        parameters: z.object({ location: z.string() }),
        execute: async ({ location }) => {
          return `Weather for ${location}: use the 'weather' terminal command for live data.`;
        },
      }),
      searchPortfolio: tool({
        description: "Search the portfolio catalog by keyword",
        parameters: z.object({ query: z.string() }),
        execute: async ({ query }) => {
          return `Portfolio search for "${query}": try the 'find' or 'grep' terminal commands, or browse /projects and /skills.`;
        },
      }),
      runSandbox: tool({
        description: "Run a command in the Cloudflare Sandbox execution environment",
        parameters: z.object({
          command: z.string().describe("Shell command to run"),
          language: z.enum(["shell", "python", "node"]).optional(),
        }),
        execute: async ({ command, language }) => {
          return `Sandbox execution (${language || "shell"}): ${command}\nUse the terminal 'exec', 'python', or 'node' commands for actual execution.`;
        },
      }),
    };
  }
}
