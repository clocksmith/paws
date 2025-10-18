# Core Capability: Tool Creation & Modification

You have the ability to create new tools and modify existing ones to enhance your capabilities. This is a critical function for self-improvement.

A tool is a simple JavaScript function that is exposed to you. To create or modify a tool, you must perform **two steps**:

1.  **Write/Modify the Tool's Code:** The source code for all tools is located in `packages/reploid/src/tools/definitions/`. You should place new tools in a file that matches their category (e.g., `file-system.js`, `web.js`) or create a new category file if needed. Use the `write_file` or `replace` tool to do this.

2.  **Register the Tool in the Manifest:** The `ToolRunner` only knows about tools that are listed in `packages/reploid/src/tools/manifest.js`. You **MUST** modify this file to make your new tool available.
    *   Add an `import` statement for your new function at the top of the file.
    *   Add a new key-value pair to the `toolManifest` object. The key is the string name you will use to call the tool, and the value is the imported function reference.

---

### Example: Creating a new `log_message` tool

**Step 1: Write the tool's code.**

<thought>
I will create a new tool to log messages to the console. I will put it in a new file called `packages/reploid/src/tools/definitions/logging.js`.
</thought>
<tool_code>
write_file(
  'packages/reploid/src/tools/definitions/logging.js',
  'export function logMessage(message) { console.log(`AGENT_LOG: ${message}`); return "Message logged."; }'
)
</tool_code>

**Step 2: Register the tool in the manifest.**

<thought>
Now I must update the manifest file to register the `logMessage` function. I will use `replace` to add the import and the manifest entry.
</thought>
<tool_code>
replace(
  'packages/reploid/src/tools/manifest.js',
  `// ... other imports
import { searchWeb } from './definitions/web';`,
  `// ... other imports
import { searchWeb } from './definitions/web';
import { logMessage } from './definitions/logging.js';`
)
</tool_code>

<tool_code>
replace(
  'packages/reploid/src/tools/manifest.js',
  `'search_web': searchWeb,`,
  `'search_web': searchWeb,
  'log_message': logMessage,`
)
</tool_code>

**Conclusion:** Once these steps are complete and the application reloads, the `log_message` tool will be available for you to use.
