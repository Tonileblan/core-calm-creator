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

const CLICLICK_PATH = "/opt/homebrew/bin/cliclick";
const SCREENCAPTURE_PATH = "/usr/sbin/screencapture";
const OSASCRIPT_PATH = "/usr/bin/osascript";

const server = new Server(
  {
    name: "macos-control",
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
    name: "macos_take_screenshot",
    description: "Takes a screenshot of the entire macOS screen or active window and saves it to disk.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Optional destination path for the screenshot (PNG). Defaults to /tmp/screenshot_<timestamp>.png.",
        },
        windowOnly: {
          type: "boolean",
          description: "If true, captures only the currently active window instead of the full screen.",
        },
      },
    },
  },
  {
    name: "macos_mouse_click",
    description: "Moves the mouse and clicks at specified (X, Y) pixel coordinates.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "X coordinate in pixels" },
        y: { type: "number", description: "Y coordinate in pixels" },
        button: {
          type: "string",
          enum: ["left", "right", "double", "triple", "middle"],
          description: "Type of click. Defaults to 'left'.",
        },
        restore: {
          type: "boolean",
          description: "Restore mouse to previous position after click. Defaults to false.",
        },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "macos_mouse_move",
    description: "Moves the mouse cursor smoothly or instantly to (X, Y) pixel coordinates.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "Target X coordinate" },
        y: { type: "number", description: "Target Y coordinate" },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "macos_mouse_drag",
    description: "Drags and drops from start (X, Y) coordinates to end (X, Y) coordinates.",
    inputSchema: {
      type: "object",
      properties: {
        startX: { type: "number", description: "Start X coordinate" },
        startY: { type: "number", description: "Start Y coordinate" },
        endX: { type: "number", description: "End X coordinate" },
        endY: { type: "number", description: "End Y coordinate" },
      },
      required: ["startX", "startY", "endX", "endY"],
    },
  },
  {
    name: "macos_type_text",
    description: "Types a string of text on the keyboard into the currently focused window.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The text to type." },
      },
      required: ["text"],
    },
  },
  {
    name: "macos_press_key",
    description: "Presses a key or key combination (e.g., return, space, escape, tab, arrows, cmd+c, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "Key name (e.g. 'return', 'space', 'escape', 'tab', 'delete', 'up', 'down', 'left', 'right', 'f1'-'f12', or single character 'c', 'v', 'a', etc.)",
        },
        modifiers: {
          type: "array",
          items: {
            type: "string",
            enum: ["cmd", "command", "alt", "option", "ctrl", "control", "shift"],
          },
          description: "List of modifier keys to hold down while pressing the key.",
        },
      },
      required: ["key"],
    },
  },
  {
    name: "macos_run_applescript",
    description: "Executes an AppleScript script for deep automation of macOS applications, dialogs, and settings.",
    inputSchema: {
      type: "object",
      properties: {
        script: {
          type: "string",
          description: "The AppleScript code to execute.",
        },
      },
      required: ["script"],
    },
  },
  {
    name: "macos_launch_or_focus_app",
    description: "Opens an application or brings it to the foreground.",
    inputSchema: {
      type: "object",
      properties: {
        appName: {
          type: "string",
          description: "Name of the application (e.g., 'Safari', 'Finder', 'Spotify', 'Notes', 'Visual Studio Code').",
        },
      },
      required: ["appName"],
    },
  },
  {
    name: "macos_get_frontmost_app",
    description: "Retrieves the currently active (frontmost) application name and window title.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "macos_get_display_info",
    description: "Retrieves screen resolution and display bounds.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "macos_clipboard",
    description: "Reads from or writes text to the macOS system clipboard.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["get", "set"],
          description: "'get' to read clipboard, 'set' to copy new text into clipboard.",
        },
        text: {
          type: "string",
          description: "Text to copy into clipboard (required if action is 'set').",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "macos_system_volume",
    description: "Gets or sets the system audio output volume, or toggles mute.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["get", "set", "mute", "unmute"],
          description: "Action to perform on system volume.",
        },
        volume: {
          type: "number",
          description: "Volume level from 0 to 100 (required if action is 'set').",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "macos_send_notification",
    description: "Sends a native macOS notification popup banner.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Notification title." },
        message: { type: "string", description: "Notification message body." },
        sound: {
          type: "string",
          description: "Optional sound name (e.g. 'default', 'Ping', 'Basso', 'Blow', 'Bottle', 'Frog', 'Funk', 'Glass', 'Hero', 'Morse', 'Pop', 'Purr', 'Sosumi', 'Submarine', 'Tink').",
        },
      },
      required: ["title", "message"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "macos_take_screenshot": {
        const dest =
          args?.filePath ||
          path.join(os.tmpdir(), `screenshot_${Date.now()}.png`);
        const screencaptureArgs = ["-x"];
        if (args?.windowOnly) {
          screencaptureArgs.push("-w");
        }
        screencaptureArgs.push(dest);

        await execFilePromise(SCREENCAPTURE_PATH, screencaptureArgs);
        const stats = await fs.stat(dest);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  filePath: dest,
                  fileSizeBytes: stats.size,
                  message: `Screenshot saved successfully to ${dest}`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "macos_mouse_click": {
        const { x, y, button = "left", restore = false } = args;
        let actionPrefix = "c";
        if (button === "right") actionPrefix = "rc";
        else if (button === "double") actionPrefix = "dc";
        else if (button === "triple") actionPrefix = "tc";
        else if (button === "middle") actionPrefix = "mc";

        const cliclickArgs = [];
        if (restore) cliclickArgs.push("-r");
        cliclickArgs.push(`${actionPrefix}:${Math.round(x)},${Math.round(y)}`);

        await execFilePromise(CLICLICK_PATH, cliclickArgs);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                action: button,
                coordinates: { x, y },
              }),
            },
          ],
        };
      }

      case "macos_mouse_move": {
        const { x, y } = args;
        await execFilePromise(CLICLICK_PATH, [`m:${Math.round(x)},${Math.round(y)}`]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, coordinates: { x, y } }),
            },
          ],
        };
      }

      case "macos_mouse_drag": {
        const { startX, startY, endX, endY } = args;
        const cliclickArgs = [
          `dd:${Math.round(startX)},${Math.round(startY)}`,
          "w:50",
          `dm:${Math.round(endX)},${Math.round(endY)}`,
          "w:50",
          `du:${Math.round(endX)},${Math.round(endY)}`,
        ];
        await execFilePromise(CLICLICK_PATH, cliclickArgs);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                from: { x: startX, y: startY },
                to: { x: endX, y: endY },
              }),
            },
          ],
        };
      }

      case "macos_type_text": {
        const { text } = args;
        // Use cliclick type command
        await execFilePromise(CLICLICK_PATH, [`t:${text}`]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                typedLength: text.length,
              }),
            },
          ],
        };
      }

      case "macos_press_key": {
        const { key, modifiers = [] } = args;
        const modMap = {
          cmd: "command",
          command: "command",
          alt: "option",
          option: "option",
          ctrl: "control",
          control: "control",
          shift: "shift",
        };

        const normalizedMods = modifiers
          .map((m) => modMap[m.toLowerCase()])
          .filter(Boolean);

        if (normalizedMods.length > 0) {
          // Use AppleScript for reliable modifier key strokes
          let modString = "";
          if (normalizedMods.length === 1) {
            modString = `using ${normalizedMods[0]} down`;
          } else {
            modString = `using {${normalizedMods.map((m) => `${m} down`).join(", ")}}`;
          }

          let keyScript;
          if (key.toLowerCase() === "return" || key.toLowerCase() === "enter") {
            keyScript = `tell application "System Events" to key code 36 ${modString}`;
          } else if (key.toLowerCase() === "space") {
            keyScript = `tell application "System Events" to key code 49 ${modString}`;
          } else if (key.toLowerCase() === "escape" || key.toLowerCase() === "esc") {
            keyScript = `tell application "System Events" to key code 53 ${modString}`;
          } else if (key.toLowerCase() === "tab") {
            keyScript = `tell application "System Events" to key code 48 ${modString}`;
          } else {
            const escapedKey = key.replace(/"/g, '\\"');
            keyScript = `tell application "System Events" to keystroke "${escapedKey}" ${modString}`;
          }

          const { stdout } = await execFilePromise(OSASCRIPT_PATH, ["-e", keyScript]);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  key,
                  modifiers: normalizedMods,
                  output: stdout.trim(),
                }),
              },
            ],
          };
        } else {
          // Use cliclick kp:key
          await execFilePromise(CLICLICK_PATH, [`kp:${key}`]);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: true, key }),
              },
            ],
          };
        }
      }

      case "macos_run_applescript": {
        const { script } = args;
        const { stdout, stderr } = await execFilePromise(OSASCRIPT_PATH, ["-e", script]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                output: stdout.trim(),
                error: stderr.trim() || undefined,
              }),
            },
          ],
        };
      }

      case "macos_launch_or_focus_app": {
        const { appName } = args;
        const script = `tell application "${appName}" to activate`;
        await execFilePromise(OSASCRIPT_PATH, ["-e", script]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Application '${appName}' activated and brought to front.`,
              }),
            },
          ],
        };
      }

      case "macos_get_frontmost_app": {
        const script = `
          tell application "System Events"
            set frontApp to first application process whose frontmost is true
            set appName to name of frontApp
            set winTitle to ""
            try
              set winTitle to name of front window of frontApp
            end try
            return appName & " |::| " & winTitle
          end tell
        `;
        const { stdout } = await execFilePromise(OSASCRIPT_PATH, ["-e", script]);
        const [appName, windowTitle] = stdout.trim().split(" |::| ");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                frontmostApplication: appName || "Unknown",
                activeWindowTitle: windowTitle || "",
              }),
            },
          ],
        };
      }

      case "macos_get_display_info": {
        const script = `tell application "Finder" to get bounds of window of desktop`;
        let bounds = null;
        try {
          const { stdout } = await execFilePromise(OSASCRIPT_PATH, ["-e", script]);
          const parts = stdout.trim().split(",").map((s) => parseInt(s.trim(), 10));
          if (parts.length === 4) {
            bounds = {
              x: parts[0],
              y: parts[1],
              width: parts[2] - parts[0],
              height: parts[3] - parts[1],
            };
          }
        } catch (_) {}

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                bounds,
              }),
            },
          ],
        };
      }

      case "macos_clipboard": {
        const { action, text } = args;
        if (action === "get") {
          const { stdout } = await execPromise("pbpaste");
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  clipboardText: stdout,
                }),
              },
            ],
          };
        } else {
          const proc = exec("pbcopy");
          proc.stdin.write(text || "");
          proc.stdin.end();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: "Text copied to system clipboard.",
                }),
              },
            ],
          };
        }
      }

      case "macos_system_volume": {
        const { action, volume } = args;
        if (action === "get") {
          const { stdout } = await execFilePromise(OSASCRIPT_PATH, [
            "-e",
            "output volume of (get volume settings)",
          ]);
          const { stdout: muteStatus } = await execFilePromise(OSASCRIPT_PATH, [
            "-e",
            "output muted of (get volume settings)",
          ]);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  volume: parseInt(stdout.trim(), 10),
                  muted: muteStatus.trim() === "true",
                }),
              },
            ],
          };
        } else if (action === "set") {
          const clamped = Math.max(0, Math.min(100, Math.round(volume || 0)));
          await execFilePromise(OSASCRIPT_PATH, [
            "-e",
            `set volume output volume ${clamped}`,
          ]);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  volume: clamped,
                }),
              },
            ],
          };
        } else if (action === "mute") {
          await execFilePromise(OSASCRIPT_PATH, [
            "-e",
            "set volume with output muted",
          ]);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: true, muted: true }),
              },
            ],
          };
        } else if (action === "unmute") {
          await execFilePromise(OSASCRIPT_PATH, [
            "-e",
            "set volume without output muted",
          ]);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: true, muted: false }),
              },
            ],
          };
        }
        break;
      }

      case "macos_send_notification": {
        const { title, message, sound } = args;
        const soundClause = sound ? `sound name "${sound}"` : "";
        const script = `display notification "${message.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}" ${soundClause}`;
        await execFilePromise(OSASCRIPT_PATH, ["-e", script]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                notification: { title, message },
              }),
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
          text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
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
  process.stderr.write(`Fatal error running macOS Control MCP server: ${err}\n`);
  process.exit(1);
});
