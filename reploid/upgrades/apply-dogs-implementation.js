// Proper implementation for apply_dogs_bundle tool
// This replaces the stubbed version in tool-runner.js

const applyDogsBundleImplementation = async (toolArgs, deps) => {
    const { StateManager, logger, Errors } = deps;
    const { ArtifactError, ToolError } = Errors;
    const { dogs_path, verify_command } = toolArgs;

    const dogsContent = await StateManager.getArtifactContent(dogs_path);
    if (!dogsContent) {
        throw new ArtifactError(`Dogs bundle not found: ${dogs_path}`);
    }

    // Parse the dogs.md bundle to extract changes
    const changes = [];
    const blocks = dogsContent.split('```paws-change');

    for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const metaEnd = block.indexOf('```');
        if (metaEnd === -1) continue;

        const meta = block.substring(0, metaEnd).trim();
        const operationMatch = meta.match(/operation:\s*(\w+)/);
        const filePathMatch = meta.match(/file_path:\s*(.+)/);

        if (!operationMatch || !filePathMatch) continue;

        const operation = operationMatch[1];
        const filePath = filePathMatch[1].trim();

        let newContent = '';
        if (operation !== 'DELETE') {
            const contentStart = block.indexOf('```', metaEnd + 3);
            if (contentStart !== -1) {
                const actualStart = contentStart + 3;
                const contentEnd = block.indexOf('```', actualStart);
                if (contentEnd !== -1) {
                    // Handle newline after opening ```
                    let startIdx = actualStart;
                    if (block[startIdx] === '\n') startIdx++;
                    newContent = block.substring(startIdx, contentEnd);
                }
            }
        }

        changes.push({ operation, file_path: filePath, new_content: newContent });
    }

    if (changes.length === 0) {
        return { success: false, message: "No valid changes found in dogs bundle" };
    }

    // Create checkpoint before applying changes
    const checkpoint = await StateManager.createCheckpoint(`Before applying ${dogs_path}`);
    logger.info(`[ToolRunner] Created checkpoint: ${checkpoint.id}`);

    const appliedChanges = [];
    try {
        // Apply each change
        for (const change of changes) {
            logger.info(`[ToolRunner] Applying ${change.operation} to ${change.file_path}`);

            if (change.operation === 'CREATE') {
                const existing = await StateManager.getArtifactContent(change.file_path);
                if (existing !== null) {
                    throw new ToolError(`Cannot CREATE ${change.file_path}: file already exists`);
                }
                await StateManager.createArtifact(
                    change.file_path,
                    'text',
                    change.new_content,
                    'Created by dogs bundle'
                );
                appliedChanges.push(change);

            } else if (change.operation === 'MODIFY') {
                const existing = await StateManager.getArtifactContent(change.file_path);
                if (existing === null) {
                    throw new ToolError(`Cannot MODIFY ${change.file_path}: file not found`);
                }
                await StateManager.updateArtifact(change.file_path, change.new_content);
                appliedChanges.push(change);

            } else if (change.operation === 'DELETE') {
                await StateManager.deleteArtifact(change.file_path);
                appliedChanges.push(change);
            }
        }

        // Run verification if provided
        if (verify_command) {
            logger.info(`[ToolRunner] Running verification: ${verify_command}`);
            // For now, log that verification would run
            // In production, this would execute the command in a sandboxed environment
            logger.warn("[ToolRunner] Verification execution pending Web Worker implementation");
        }

        return {
            success: true,
            message: `Successfully applied ${appliedChanges.length} changes`,
            changes_applied: appliedChanges.length,
            checkpoint: checkpoint.id
        };

    } catch (error) {
        // Rollback on error
        logger.error(`[ToolRunner] Error applying changes, rolling back to checkpoint ${checkpoint.id}`);
        await StateManager.restoreCheckpoint(checkpoint.id);
        throw new ToolError(`Failed to apply dogs bundle: ${error.message}`);
    }
};

// Export for use in tool-runner.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = applyDogsBundleImplementation;
}