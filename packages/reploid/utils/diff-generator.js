// Simple Diff Generator Utility

const DiffGenerator = {
    createDiff: (oldContent, newContent) => {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        const diff = [];

        let i = 0, j = 0;
        while (i < oldLines.length || j < newLines.length) {
            if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
                diff.push({ type: 'context', line: oldLines[i] });
                i++;
                j++;
            } else {
                if (i < oldLines.length) {
                    diff.push({ type: 'remove', line: oldLines[i] });
                    i++;
                }
                if (j < newLines.length) {
                    diff.push({ type: 'add', line: newLines[j] });
                    j++;
                }
            }
        }
        return diff;
    }
};

const DiffGeneratorModule = {
    metadata: {
        id: 'DiffGenerator',
        version: '1.0.0',
        dependencies: [],
        async: false,
        type: 'utility'
    },
    factory: () => ({ api: DiffGenerator })
};

// Expose as global for the UI manager to use
if (typeof window !== 'undefined') {
    window.DiffGenerator = DiffGenerator;
}

export default DiffGeneratorModule;
export { DiffGenerator };
