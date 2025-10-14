// Code Refactorer Persona - Project Phoenix

const CodeRefactorerPersona = {
  metadata: {
    id: 'CodeRefactorerPersona',
    version: '1.0.0',
    // This persona doesn't have direct dependencies to be injected
    // but it will be injected into the AgentCycle.
    dependencies: [], 
    type: 'persona'
  },
  factory: () => {
    const getSystemPromptFragment = () => {
      return "You are a senior software engineer specializing in code quality. Your task is to analyze code for improvements, fix bugs, and enhance performance. You should be meticulous and provide clear justifications for your proposed changes.";
    };

    const filterTools = (availableTools) => {
      // Example: Prioritize analysis and writing tools
      const priority = ['search_vfs', 'read_artifact', 'write_artifact', 'diff_artifacts'];
      return availableTools.sort((a, b) => {
        const aPriority = priority.indexOf(a.name);
        const bPriority = priority.indexOf(b.name);
        if (aPriority === -1 && bPriority === -1) return 0;
        if (aPriority === -1) return 1;
        if (bPriority === -1) return -1;
        return aPriority - bPriority;
      });
    };

    const onCycleStart = (cycleContext) => {
      // Example hook: could automatically run a code analysis tool
      console.log("CodeRefactorer Persona: Cycle started. Analyzing goal...");
    };

    return {
      // The public API of the persona module
      getSystemPromptFragment,
      filterTools,
      onCycleStart
    };
  }
};

CodeRefactorerPersona;
