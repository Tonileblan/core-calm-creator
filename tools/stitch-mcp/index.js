#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execFile, exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const execPromise = promisify(exec);
const execFilePromise = promisify(execFile);
const SCREENCAPTURE_PATH = "/usr/sbin/screencapture";

const server = new Server(
  {
    name: "stitch-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const TOOLS = [
  {
    name: "stitch_status",
    description: "Checks if Google Stitch (stitch.withgoogle.com) is open in Chrome, Brave, or Safari, returning active tabs and window titles.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "stitch_open",
    description: "Opens https://stitch.withgoogle.com in the specified browser (Google Chrome, Brave Browser, Safari) and focuses the window.",
    inputSchema: {
      type: "object",
      properties: {
        browser: {
          type: "string",
          enum: ["Google Chrome", "Brave Browser", "Safari", "default"],
          description: "Target browser to open Stitch in. Defaults to Google Chrome.",
        },
        focusWindow: {
          type: "boolean",
          description: "If true, brings the browser window to the foreground. Defaults to true.",
        },
      },
    },
  },
  {
    name: "stitch_generate_prompt",
    description: "Generates a comprehensive, high-fidelity UI design prompt tailored for Google Stitch (Gemini AI UI engine) and optionally copies it to clipboard.",
    inputSchema: {
      type: "object",
      properties: {
        appName: {
          type: "string",
          description: "Name of the application/project (e.g. 'Control 61 - Sistemas de Seguridad')",
        },
        appType: {
          type: "string",
          description: "Type of app (e.g. 'Security & SOC SaaS Platform', 'E-commerce', 'Mobile CRM')",
        },
        theme: {
          type: "string",
          description: "Visual aesthetic and color theme (e.g. 'Dark Cyberpunk & Tactical Red', 'Clean Minimal Titanium', 'Electric Blue')",
        },
        screens: {
          type: "array",
          items: { type: "string" },
          description: "List of screens/pages to describe (e.g. ['Master Landing', 'SOC 24h Dashboard', 'Services Grid', 'Contact Audit'])",
        },
        copyToClipboard: {
          type: "boolean",
          description: "If true, copies the generated prompt to macOS clipboard (pbcopy). Defaults to true.",
        },
      },
      required: ["appName", "screens"],
    },
  },
  {
    name: "stitch_capture_canvas",
    description: "Takes a high-resolution screenshot of the Stitch design canvas or active browser window.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Optional destination file path (PNG). Defaults to /tmp/stitch_canvas_<timestamp>.png.",
        },
      },
    },
  },
  {
    name: "stitch_import_component",
    description: "Imports exported HTML/React/Tailwind component code from Stitch and saves it to a designated file in the project.",
    inputSchema: {
      type: "object",
      properties: {
        targetFile: {
          type: "string",
          description: "Destination file path relative to workspace or absolute (e.g. 'src/components/stitch/StitchDashboard.tsx')",
        },
        codeContent: {
          type: "string",
          description: "The exported JSX/HTML/React code from Google Stitch.",
        },
        description: {
          type: "string",
          description: "Brief note describing what component this is.",
        },
      },
      required: ["targetFile", "codeContent"],
    },
  },
  {
    name: "stitch_list_templates",
    description: "Lists built-in UI design prompt templates for Google Stitch across various domains (Security, SOC, SaaS, E-Commerce, Mobile).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Helper: Check running browser tabs for Stitch
async function checkStitchStatus() {
  const results = [];
  const browsers = ["Google Chrome", "Brave Browser", "Safari"];

  for (const browser of browsers) {
    try {
      if (browser === "Google Chrome" || browser === "Brave Browser") {
        const script = `
          tell application "System Events"
            if (exists process "${browser}") then
              tell application "${browser}"
                set foundUrls to {}
                set winList to every window
                repeat with w in winList
                  set tabList to every tab of w
                  repeat with t in tabList
                    set u to URL of t
                    if u contains "stitch.withgoogle.com" then
                      set end of foundUrls to (title of t & " => " & u)
                    end if
                  end repeat
                end repeat
                return foundUrls
              end tell
            else
              return "NOT_RUNNING"
            end if
          end tell
        `;
        const { stdout } = await execFilePromise("osascript", ["-e", script]);
        const trimmed = stdout.trim();
        if (trimmed && trimmed !== "NOT_RUNNING" && trimmed !== "") {
          results.push({
            browser,
            status: "OPEN_AND_FOUND",
            tabs: trimmed.split(", ").filter(Boolean),
          });
        } else if (trimmed === "NOT_RUNNING") {
          results.push({ browser, status: "NOT_RUNNING" });
        } else {
          results.push({ browser, status: "RUNNING_NO_STITCH_TAB" });
        }
      } else if (browser === "Safari") {
        const script = `
          tell application "System Events"
            if (exists process "Safari") then
              tell application "Safari"
                set foundUrls to {}
                set winList to every window
                repeat with w in winList
                  set tabList to every tab of w
                  repeat with t in tabList
                    set u to URL of t
                    if u contains "stitch.withgoogle.com" then
                      set end of foundUrls to (name of t & " => " & u)
                    end if
                  end repeat
                end repeat
                return foundUrls
              end tell
            else
              return "NOT_RUNNING"
            end if
          end tell
        `;
        const { stdout } = await execFilePromise("osascript", ["-e", script]);
        const trimmed = stdout.trim();
        if (trimmed && trimmed !== "NOT_RUNNING" && trimmed !== "") {
          results.push({
            browser,
            status: "OPEN_AND_FOUND",
            tabs: trimmed.split(", ").filter(Boolean),
          });
        } else if (trimmed === "NOT_RUNNING") {
          results.push({ browser, status: "NOT_RUNNING" });
        } else {
          results.push({ browser, status: "RUNNING_NO_STITCH_TAB" });
        }
      }
    } catch (err) {
      results.push({ browser, status: "ERROR", error: err.message });
    }
  }

  return {
    url: "https://stitch.withgoogle.com",
    browsers: results,
    isStitchOpen: results.some((r) => r.status === "OPEN_AND_FOUND"),
  };
}

// Tool definitions schema registration
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Request handling
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "stitch_status": {
        const status = await checkStitchStatus();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(status, null, 2),
            },
          ],
        };
      }

      case "stitch_open": {
        const browser = args?.browser || "Google Chrome";
        const focusWindow = args?.focusWindow !== false;

        let cmd = `open "https://stitch.withgoogle.com"`;
        if (browser && browser !== "default") {
          cmd = `open -a "${browser}" "https://stitch.withgoogle.com"`;
        }

        await execPromise(cmd);

        if (focusWindow && browser !== "default") {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          await execFilePromise("osascript", [
            "-e",
            `tell application "${browser}" to activate`,
          ]);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Opened https://stitch.withgoogle.com in ${browser}`,
                  browser,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "stitch_generate_prompt": {
        const { appName, appType, theme, screens, copyToClipboard } = args;

        const formattedScreens = screens
          .map((s, i) => `   ${i + 1}. **${s}**: Detailed, interactive layout with production-grade components, realistic data, high typography hierarchy, and state badges.`)
          .join("\n");

        const prompt = `# PROJECT: ${appName}
## AESTHETIC & THEME:
- App Type: ${appType || "Modern Web Application & Operations Suite"}
- Visual System: ${theme || "Dark Obsidian #030712, Crimson Red #DC2626, Cyan telemetry #06B6D4, Titanium borders"}
- Design Principles: Bento grid modular cards, high-contrast badges, micro-interactions, responsive flex/grid layouts.

## SCREENS TO GENERATE:
${formattedScreens}

## CORE ASSETS & BADGES:
- Verified Security Accreditation & Official Homologation Seals
- 24/7 Live Telemetry Ticker with real-time status indicators
- Dark glassmorphic floating navbars with status chips
- Comprehensive footers with legal accreditation and direct hotlines.`;

        if (copyToClipboard !== false) {
          const proc = exec("pbcopy");
          proc.stdin.write(prompt);
          proc.stdin.end();
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  copiedToClipboard: copyToClipboard !== false,
                  promptLength: prompt.length,
                  prompt,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "stitch_capture_canvas": {
        const targetPath =
          args?.filePath ||
          path.join(os.tmpdir(), `stitch_canvas_${Date.now()}.png`);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });

        await execPromise(`${SCREENCAPTURE_PATH} -x "${targetPath}"`);
        const stats = await fs.stat(targetPath);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  filePath: targetPath,
                  fileSizeBytes: stats.size,
                  message: `Canvas screenshot saved to ${targetPath}`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "stitch_import_component": {
        const { targetFile, codeContent, description } = args;
        const resolvedPath = path.isAbsolute(targetFile)
          ? targetFile
          : path.resolve(process.cwd(), targetFile);

        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.writeFile(resolvedPath, codeContent, "utf8");

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  savedPath: resolvedPath,
                  description: description || "Component imported from Stitch",
                  bytesWritten: Buffer.byteLength(codeContent),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "stitch_list_templates": {
        const templates = [
          {
            id: "security-soc",
            name: "Security & SOC Telemetry Hub",
            description: "Industrial dark mode with real-time sensor radar, 24/7 emergency dispatch, and Grado 3 matrix.",
          },
          {
            id: "executive-c-level",
            name: "Platinum Executive Corporate Defense",
            description: "Clean titanium theme with compliance SLA tables, national infrastructure map, and VIP concierge.",
          },
          {
            id: "saas-analytics",
            name: "AI Vision & Video Analytics Studio",
            description: "Modern Bento grid with live RTSP stream bounding boxes, confidence scores, and multi-camera switcher.",
          },
        ];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, templates }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${error.message}`,
        },
      ],
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

run().catch((err) => {
  console.error("Fatal error running Stitch MCP server:", err);
  process.exit(1);
});
