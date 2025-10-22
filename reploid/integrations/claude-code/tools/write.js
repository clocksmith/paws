
import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';

// Per security guidelines, tools should operate within the project directory.
const projectRoot = path.resolve(process.cwd());

const inputSchema = z.object({
  path: z.string().describe("The relative path to the file to write to in the project directory."),
  content: z.string().describe("The content to write to the file."),
});

async function call({ path: relativePath, content }) {
  try {
    const absolutePath = path.resolve(projectRoot, relativePath);

    // Security check: Ensure the path is still within the project root
    if (!absolutePath.startsWith(projectRoot)) {
        return { error: "Access denied: Path is outside of the project directory." };
    }

    await fs.writeFile(absolutePath, content, 'utf-8');
    return { success: true, message: `Successfully wrote to ${relativePath}` };
  } catch (error) {
    console.error(`Error writing file at ${relativePath}:`, error);
    return { error: `Failed to write file: ${error.message}` };
  }
}

export const tool = {
  name: "write",
  description: "Writes (or overwrites) the content of a specified file.",
  inputSchema,
  call,
};
