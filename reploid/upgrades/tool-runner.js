// Standardized Tool Runner Module for REPLOID
// Executes static and dynamic tools within the agent

const ToolRunner = {
  metadata: {
    id: 'ToolRunner',
    version: '1.0.0',
    dependencies: ['config', 'Storage', 'StateManager', 'ApiClient', 'Utils', 'ToolRunnerPureHelpers'],
    async: false,
    type: 'service'
  },
  
  factory: (deps) => {
    // Validate dependencies
    const { config, Storage, StateManager, ApiClient, Utils, ToolRunnerPureHelpers } = deps;
    const { logger, Errors } = Utils;
    
    if (!config || !logger || !Storage || !StateManager || !ApiClient || !Errors || !Utils || !ToolRunnerPureHelpers) {
      throw new Error('ToolRunner: Missing required dependencies');
    }
    
    const { ToolError, ArtifactError } = Errors;

  const runTool = async (
    toolName,
    toolArgs,
    injectedStaticTools,
    injectedDynamicTools
  ) => {
    logger.logEvent("info", `Run tool: ${toolName}`, toolArgs || {});
    UI.logToAdvanced(`Running tool: ${toolName} with args: ${JSON.stringify(toolArgs)}`);
    const allTools = [...injectedStaticTools, ...injectedDynamicTools.map(t=>t.declaration)];
    const toolDef = allTools.find((t) => t.name === toolName);
    
    if (!toolDef) {
        const available = allTools.map(t => t.name).join(', ');
        throw new ToolError(`Tool '${toolName}' not found. Available tools: ${available}`);
    }

    if (injectedStaticTools.some(t => t.name === toolName)) {
      switch (toolName) {
        case "read_artifact": {
          const content = await StateManager.getArtifactContent(toolArgs.path, toolArgs.version);
          if (content === null) {
            const allMeta = await StateManager.getAllArtifactMetadata();
            const available = Object.keys(allMeta).slice(0, 5).join(', ');
            const msg = `Artifact not found: ${toolArgs.path} (version: ${toolArgs.version || 'latest'})\n` +
                       `Suggestion: Check the path is correct. Some available artifacts: ${available}${Object.keys(allMeta).length > 5 ? '...' : ''}`;
            throw new ArtifactError(msg, toolArgs.path);
          }
          return { content };
        }

        case "list_artifacts": {
          const allMeta = await StateManager.getAllArtifactMetadata();
          let paths = Object.keys(allMeta);
          if (toolArgs.path) {
            paths = paths.filter(p => p.startsWith(toolArgs.path));
          }
          return { paths };
        }
          
        case "diff_artifacts": {
            const contentA = await StateManager.getArtifactContent(toolArgs.path, toolArgs.version_a);
            const contentB = await StateManager.getArtifactContent(toolArgs.path, toolArgs.version_b);
            if (contentA === null || contentB === null) {
                const missing = contentA === null ? toolArgs.version_a : toolArgs.version_b;
                throw new ArtifactError(
                  `Cannot diff: version '${missing}' not found for ${toolArgs.path}\n` +
                  `Tip: Use get_artifact_history tool to see available versions.`
                );
            }
            // Basic diff for now, a proper library would be better.
            return { diff: `(Basic diff not implemented. Len A: ${contentA.length}, Len B: ${contentB.length})`, differences: contentA !== contentB };
        }

        case "get_artifact_history": {
            return await StateManager.getArtifactHistory(toolArgs.path);
        }

        case "vfs_log": {
            return await StateManager.getArtifactHistory(toolArgs.path);
        }

        case "vfs_diff": {
            return await StateManager.getArtifactDiff(toolArgs.path, toolArgs.refA, toolArgs.refB);
        }

        case \"create_cats_bundle\": {\n            const { file_paths, reason, turn_path } = toolArgs;\n            let bundleContent = `## PAWS Context Bundle (cats.md)\\n\\n**Reason:** ${reason}\\n\\n---\\n\\n`;\n            for (const path of file_paths) {\n                const content = await StateManager.getArtifactContent(path);\n                bundleContent += `\`\`\`vfs-file\npath: ${path}\n\`\`\`\\n\`\`\`\n${content}\n\`\`\`\\n\\n`;\n            }\n            await StateManager.createArtifact(turn_path, \'markdown\', bundleContent, `Context bundle for turn`);\n            return { success: true, path: turn_path };\n        }\n\n        case \"create_dogs_bundle\": {\n            const { changes, turn_path } = toolArgs;\n            let bundleContent = `## PAWS Change Proposal (dogs.md)\\n\\n`;\n            for (const change of changes) {\n                bundleContent += `\`\`\`paws-change\noperation: ${change.operation}\nfile_path: ${change.file_path}\n\`\`\`\\n`;\n                if (change.operation !== \'DELETE\') {\n                    bundleContent += `\`\`\`\n${change.new_content}\n\`\`\`\\n\\n`;\n                }\n            }\n            await StateManager.createArtifact(turn_path, \'markdown\', bundleContent, `Change proposal for turn`);\n            return { success: true, path: turn_path };\n        }\n\n        case \"apply_dogs_bundle\": {\n            const { dogs_path, verify_command } = toolArgs;\n            // In a real implementation, this would use the Git VFS to checkpoint.\n            logger.warn(\"[ToolRunner] apply_dogs_bundle is a stub. It does not currently support verification or rollback.\");\n            \n            const dogsContent = await StateManager.getArtifactContent(dogs_path);\n            // Basic parsing logic\n            const changes = []; // This would be parsed from dogsContent\n\n            for (const change of changes) {\n                if (change.operation === \'MODIFY\' || change.operation === \'CREATE\') {\n                    await StateManager.updateArtifact(change.file_path, change.new_content);\n                } else if (change.operation === \'DELETE\') {\n                    await StateManager.deleteArtifact(change.file_path);\n                }\n            }\n            return { success: true, message: \"Changes applied (stubbed).\" };\n        }\n\n        case \"vfs_revert\": {
            const { path, commit_sha } = toolArgs;
            const oldContent = await StateManager.getArtifactContent(path, commit_sha);
            if (oldContent === null) {
                throw new ArtifactError(
                  `Cannot revert ${path}: version ${commit_sha} not found\n` +
                  `Tip: Use get_artifact_history to see available commit SHAs for this file.`
                );
            }
            await StateManager.updateArtifact(path, oldContent);
            return { success: true, message: `Artifact ${path} reverted to version ${commit_sha}` };
        }


        case "search_vfs": {
            // This would be slow. In a real system, an index would be needed.
            const allArtifacts = await StateManager.getAllArtifactMetadata();
            const results = [];
            const regex = toolArgs.is_regex ? new RegExp(toolArgs.query) : null;
            for (const path in allArtifacts) {
                const fileContent = await StateManager.getArtifactContent(path);
                if (fileContent) {
                    if (regex && regex.test(fileContent)) {
                        results.push(path);
                    } else if (!regex && fileContent.includes(toolArgs.query)) {
                        results.push(path);
                    }
                }
            }
            return { results };
        }

        case "write_artifact": {
            // Create or update an artifact to enable self-modification
            const { path, content, metadata } = toolArgs;
            if (!path || !content) {
                throw new ToolError("write_artifact requires both 'path' and 'content' parameters");
            }
            
            // Check if artifact exists to decide between create and update
            const existingMeta = await StateManager.getArtifactMetadata(path);
            let success;
            
            try {
                if (existingMeta) {
                    // Update existing artifact
                    success = await StateManager.updateArtifact(path, content);
                } else {
                    // Create new artifact
                    const type = path.endsWith('.js') ? 'javascript' : 
                                path.endsWith('.css') ? 'css' : 
                                path.endsWith('.html') ? 'html' : 
                                path.endsWith('.json') ? 'json' : 
                                path.endsWith('.md') ? 'markdown' : 'text';
                    success = await StateManager.createArtifact(
                        path, 
                        type, 
                        content, 
                        metadata?.reason || "Agent-created artifact"
                    );
                }
            } catch (e) {
                throw new ArtifactError(`Failed to write artifact at path: ${path} - ${e.message}`);
            }
            
            logger.logEvent("info", `Artifact written: ${path}`, metadata?.reason || "No reason provided");
            return { 
                success: true, 
                path: path,
                size: content.length,
                reason: metadata?.reason || "Self-modification" 
            };
        }

        case "delete_artifact": {
            // Delete an artifact - use with extreme caution
            const deletePath = toolArgs.path;
            const deleteReason = toolArgs.reason;

            if (!deletePath || !deleteReason) {
                throw new ToolError(
                  "delete_artifact requires both 'path' and 'reason' parameters.\n" +
                  `Missing: ${!deletePath ? "'path'" : ""} ${!deleteReason ? "'reason'" : ""}\n` +
                  "Example: {path: '/vfs/old-file.js', reason: 'Obsolete after refactor'}"
                );
            }

            // Check if artifact exists
            const artifactToDelete = await StateManager.getArtifactMetadata(deletePath);
            if (!artifactToDelete) {
                const allMeta = await StateManager.getAllArtifactMetadata();
                const similar = Object.keys(allMeta).filter(p => p.includes(path.basename(deletePath))).slice(0, 3);
                const suggestion = similar.length > 0 ? `\nDid you mean: ${similar.join(', ')}` : '';
                throw new ArtifactError(`Cannot delete non-existent artifact: ${deletePath}${suggestion}`);
            }

            // Perform deletion
            const deleteSuccess = await StateManager.deleteArtifact(deletePath);

            logger.logEvent("warn", `Artifact DELETED: ${deletePath}`, deleteReason);
            return {
                success: deleteSuccess,
                path: deletePath,
                reason: deleteReason,
                warning: "Artifact permanently deleted from VFS"
            };
        }

        case "execute_python": {
            // Execute Python code via Pyodide runtime
            const { code, install_packages, sync_workspace } = toolArgs;

            if (!code) {
                throw new ToolError("execute_python requires 'code' parameter");
            }

            // Check if PyodideRuntime is available
            const PyodideRuntime = deps.PyodideRuntime || window.PyodideRuntime;
            if (!PyodideRuntime) {
                throw new ToolError("PyodideRuntime not available. Python execution requires Pyodide to be loaded.");
            }

            if (!PyodideRuntime.isReady()) {
                throw new ToolError("Python runtime not initialized. Please wait for Pyodide to load.");
            }

            // Install packages if requested
            if (install_packages && Array.isArray(install_packages)) {
                for (const pkg of install_packages) {
                    logger.logEvent("info", `Installing Python package: ${pkg}`);
                    const installResult = await PyodideRuntime.installPackage(pkg);
                    if (!installResult.success) {
                        return {
                            success: false,
                            error: `Failed to install package ${pkg}: ${installResult.error}`
                        };
                    }
                }
            }

            // Sync workspace if requested
            if (sync_workspace) {
                logger.logEvent("info", "Syncing VFS workspace to Pyodide filesystem");
                await PyodideRuntime.syncWorkspace();
            }

            // Execute Python code
            logger.logEvent("info", "Executing Python code", { lines: code.split('\n').length });
            const result = await PyodideRuntime.execute(code);

            return {
                success: result.success,
                output: result.output,
                error: result.error,
                returnValue: result.returnValue
            };
        }

        case "system.backup": {
          try {
            // StateManager doesn't have a getAllArtifacts, so we get all keys and then get content for each
            const allMeta = await StateManager.getAllArtifactMetadata();
            const allArtifacts = {};
            for (const path of Object.keys(allMeta)) {
                allArtifacts[path] = await StateManager.getArtifactContent(path);
            }
            const result = await Utils.post('/api/vfs/backup', allArtifacts);
            return { success: true, message: result.message };
          } catch (error) {
            throw new ToolError(
              `System backup failed: ${error.message}\n` +
              `Possible causes:\n` +
              `  • Server endpoint /api/vfs/backup not available\n` +
              `  • Network connection issue\n` +
              `  • Insufficient permissions\n` +
              `Tip: Check server logs and ensure backup service is running.`
            );
          }
        }
        
        case "create_rfc": {
          const templateContent = await StateManager.getArtifactContent('/templates/rfc.md');
          if (!templateContent) {
            throw new ArtifactError(
              "RFC template not found at /templates/rfc.md\n" +
              "To fix: Create the template file with {{TITLE}} and {{DATE}} placeholders.\n" +
              "Example: Use write_artifact tool to create /templates/rfc.md with your RFC template structure."
            );
          }
          const today = new Date().toISOString().split('T')[0];
          const newContent = templateContent
            .replace('{{TITLE}}', toolArgs.title)
            .replace('{{DATE}}', today);

          const safeTitle = toolArgs.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          const newPath = `/docs/rfc-${today}-${safeTitle}.md`;

          await StateManager.createArtifact(newPath, 'markdown', newContent, `RFC draft: ${toolArgs.title}`);
          UI.logToAdvanced(`RFC created at ${newPath}`);
          return { success: true, path: newPath };
        }
        
        case "export_project_zip": {
          try {
            // Get all files from VFS
            const allMeta = await StateManager.getAllArtifactMetadata();
            const files = [];
            
            for (const path of Object.keys(allMeta)) {
              const content = await StateManager.getArtifactContent(path);
              if (content !== null) {
                files.push({ path, content });
              }
            }
            
            // For now, return the file list - actual ZIP generation would require a library
            // In production, this would use JSZip or similar to create an actual ZIP blob
            const exportData = {
              projectName: toolArgs.filename || 'reploid-export',
              exportDate: new Date().toISOString(),
              fileCount: files.length,
              files: files.map(f => ({ path: f.path, size: f.content.length }))
            };
            
            UI.logToAdvanced(`Project export prepared: ${files.length} files`);
            
            // In a real implementation, we'd create a downloadable ZIP here
            // For now, we return metadata about what would be exported
            return { 
              success: true, 
              message: `Export ready: ${files.length} files would be included`,
              manifest: exportData
            };
          } catch (error) {
            throw new ToolError(
              `Project export failed: ${error.message}\n` +
              `Common issues:\n` +
              `  • Large files may exceed memory limits\n` +
              `  • Check that all artifacts are accessible\n` +
              `Tip: Try exporting specific directories instead of the entire project.`
            );
          }
        }

        default:
          throw new ToolError(`Static tool '${toolName}' is not implemented.`);
      }
    }
    
    // Execute dynamic tool
    const dynamicTool = injectedDynamicTools.find(t => t.declaration.name === toolName);
    if (dynamicTool) {
      return await executeDynamicTool(dynamicTool, toolArgs);
    }
    
    throw new ToolError(`Tool '${toolName}' is not implemented.`);
  };
  
  // Execute dynamic tool with safe execution options
  const executeDynamicTool = async (toolDef, toolArgs) => {
    logger.info(`[ToolRunner] Executing dynamic tool: ${toolDef.declaration.name}`);
    
    const { implementation } = toolDef;
    
    if (implementation.type === 'javascript') {
      // Use blob URL for safe execution if enabled
      if (config.useBlobExecution) {
        return await executeInBlobContext(implementation.code, toolArgs);
      } else {
        // Fallback to worker execution
        return await executeInWorker(implementation.code, toolArgs);
      }
    } else if (implementation.type === 'composite') {
      // Execute composite tool steps
      const results = [];
      for (const step of implementation.steps) {
        const stepResult = await runTool(step.tool, 
          JSON.parse(step.args_template.replace(/\$(\w+)/g, (_, key) => 
            JSON.stringify(toolArgs[key]))));
        results.push(stepResult);
      }
      return results;
    } else {
      throw new ToolError(`Unknown implementation type: ${implementation.type}`);
    }
  };
  
  // Execute code in blob context for safe isolation
  const executeInBlobContext = async (code, args) => {
    logger.debug('[ToolRunner] Creating blob context for safe execution');
    
    // Create isolated module code
    const moduleCode = `
      // Blob Context for Safe Tool Execution
      const execute = async (args) => {
        const run = async (params) => {
          ${code}
        };
        return await run(args);
      };
      
      // Export the executor
      export default execute;
    `;
    
    // Create blob URL
    const blob = new Blob([moduleCode], { type: 'application/javascript' });
    const moduleUrl = URL.createObjectURL(blob);
    
    try {
      // Dynamic import from blob URL
      const module = await import(moduleUrl);
      const result = await module.default(args);
      
      // Clean up
      URL.revokeObjectURL(moduleUrl);
      return result;
    } catch (error) {
      URL.revokeObjectURL(moduleUrl);
      logger.error('[ToolRunner] Blob execution failed:', error);
      throw new ToolError(
        `Tool execution failed in blob context: ${error.message}\n` +
        `This usually indicates:\n` +
        `  • Syntax error in the tool's JavaScript code\n` +
        `  • Missing or invalid tool arguments\n` +
        `  • Attempting to access unavailable APIs\n` +
        `Check the tool implementation for errors.`,
        error
      );
    }
  };
  
  // Execute code in worker (existing functionality)
  const executeInWorker = async (code, args) => {
    logger.debug('[ToolRunner] Executing in worker');
    
    return new Promise((resolve, reject) => {
      const worker = new Worker('/upgrades/tool-worker.js');
      
      worker.onmessage = (event) => {
        const { success, result, error } = event.data;
        
        if (success) {
          resolve(result);
        } else {
          reject(new ToolError(
            `Worker execution failed: ${error?.message || 'Unknown error'}\n` +
            `This can happen when:\n` +
            `  • Tool code contains syntax errors\n` +
            `  • Tool tries to access browser APIs not available in workers\n` +
            `  • Tool arguments are invalid or missing\n` +
            `Debug: Check browser console for detailed worker errors.`,
            error
          ));
        }
        worker.terminate();
      };
      
      worker.onerror = (error) => {
        reject(new ToolError(
          `Worker initialization error: ${error.message || 'Failed to start worker'}\n` +
          `Possible causes:\n` +
          `  • Worker script /upgrades/tool-worker.js not found\n` +
          `  • CSP (Content Security Policy) blocking worker creation\n` +
          `  • Browser doesn't support Web Workers\n` +
          `Check that tool-worker.js exists and is accessible.`,
          error
        ));
        worker.terminate();
      };
      
      worker.postMessage({
        type: 'init',
        payload: { toolCode: code, toolArgs: args }
      });
    });
  };

  const convertToGeminiFunctionDeclaration = (mcpToolDefinition) => {
      return ToolRunnerPureHelpers.convertToGeminiFunctionDeclarationPure(mcpToolDefinition);
  };

    // Public API
    return {
      api: {
        runTool,
        convertToGeminiFunctionDeclaration
      }
    };
  }
};

// Export standardized module
ToolRunner;