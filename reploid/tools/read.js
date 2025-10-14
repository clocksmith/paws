
import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';

// Per security guidelines, tools should operate within the project directory.
// We'll enforce this by resolving paths against the project root.
const projectRoot = path.resolve(process.cwd());

const inputSchema = z.object({
  path: z.string().describe("The relative path to the file to read from the project directory."),
});

async function call({ path: relativePath }) {
  try {
    const absolutePath = path.resolve(projectRoot, relativePath);

    // Security check: Ensure the path is still within the project root
    if (!absolutePath.startsWith(projectRoot)) {
        return { error: "Access denied: Path is outside of the project directory." };
    }

    if (!await fs.exists(absolutePath)) {
      return { error: `File not found at path: ${relativePath}` };
    }

    const content = await fs.readFile(absolutePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    console.error(`Error reading file at ${relativePath}:`, error);
    return { error: `Failed to read file: ${error.message}` };
  }
}

export const tool = {
  name: "read",
  description: "Reads the entire content of a specified file.",
  inputSchema,
  call,
};
