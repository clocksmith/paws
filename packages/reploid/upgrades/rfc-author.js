// RFC Authoring Assistant - automates structured change proposal drafting

const RFCAuthor = {
  metadata: {
    id: 'RFCAuthor',
    version: '1.0.0',
    dependencies: ['StateManager', 'Utils'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { StateManager, Utils } = deps;
    const { logger } = Utils;

    const sanitizeFileName = (title) =>
      title
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'untitled';

    const coalesce = (value, placeholder = 'TBD') =>
      value && value.trim().length > 0 ? value.trim() : placeholder;

    const ensureArray = (value) => {
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    };

    const loadTemplate = async () => {
      try {
        return await StateManager.getArtifactContent('/templates/rfc.md');
      } catch (error) {
        logger.warn('[RFCAuthor] Unable to load RFC template:', error);
        return null;
      }
    };

    const fillTemplate = (template, data) => {
      let populated = template;
      Object.entries(data).forEach(([key, value]) => {
        const token = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        populated = populated.replace(token, value);
      });
      return populated;
    };

    const buildDefaultContent = (data) => {
      const bullets = (items, emptyLabel = 'TBD') =>
        items.length ? items.map((item) => `- ${item}`).join('\n') : `- ${emptyLabel}`;

      return `# ${data.TITLE}

## Metadata
- **Author:** ${data.AUTHOR}
- **Date:** ${data.DATE}
- **Status:** ${data.STATUS}
- **Reviewers:** ${bullets(data.REVIEWERS)}
- **Target Release:** ${data.TIMELINE}

## Background
${data.BACKGROUND}

## Problem Statement
${data.PROBLEM}

## Goals & Non-Goals
### Goals
${bullets(data.GOALS)}

### Non-Goals
${bullets(data.NONGOALS)}

## Proposed Solution
${data.SOLUTION}

## Technical Scope
${data.SCOPE}

## Deliverables & Milestones
${bullets(data.DELIVERABLES)}

## Risks & Mitigations
${bullets(data.RISKS)}

## Open Questions
${bullets(data.QUESTIONS)}
`;
    };

    const ensureUniquePath = async (basePath) => {
      let candidate = basePath;
      let counter = 1;
      while (StateManager.getArtifactMetadata(candidate)) {
        candidate = `${basePath.replace(/\\.md$/, '')}-${counter}.md`;
        counter += 1;
      }
      return candidate;
    };

    const gatherRecentContext = async (limit = 5) => {
      const metadata = await StateManager.getAllArtifactMetadata();
      const entries = Object.values(metadata || {});
      const recent = entries
        .filter((item) => item && item.id && item.type)
        .slice(-limit)
        .reverse()
        .map((item) => `- \`${item.id}\` (${item.type})`);

      return recent.length
        ? recent.join('\n')
        : '- No recent artifacts recorded';
    };

    const draftRFC = async (options = {}) => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      const data = {
        TITLE: coalesce(options.title, 'Untitled RFC'),
        AUTHOR: coalesce(options.author, 'REPLOID Agent'),
        DATE: today,
        STATUS: coalesce(options.status, 'Draft'),
        REVIEWERS: ensureArray(options.reviewers),
        TIMELINE: coalesce(options.timeline, 'TBD'),
        BACKGROUND: coalesce(options.background || options.context, '*Provide relevant background here.*'),
        PROBLEM: coalesce(options.problem, '*Define the problem this RFC addresses.*'),
        GOALS: ensureArray(options.goals),
        NONGOALS: ensureArray(options.nonGoals),
        SOLUTION: coalesce(options.solution, '*Outline the proposed approach.*'),
        SCOPE: coalesce(
          options.scope,
          '### Affected Components\n- TBD\n\n### Out of Scope\n- TBD'
        ),
        DELIVERABLES: ensureArray(options.deliverables),
        RISKS: ensureArray(options.risks),
        QUESTIONS: ensureArray(options.openQuestions)
      };

      if (!options.includeArtifacts === false) {
        const contextBullets = await gatherRecentContext();
        data.SCOPE += `\n\n### Recent Artifacts\n${contextBullets}`;
      }

      const template = await loadTemplate();
      const content = template ? fillTemplate(template, data) : buildDefaultContent(data);

      const safeTitle = sanitizeFileName(data.TITLE);
      const basePath = `/docs/rfc-${today}-${safeTitle}.md`;
      const path = await ensureUniquePath(basePath);

      await StateManager.createArtifact(path, 'document', content, `RFC draft: ${data.TITLE}`);
      logger.info(`[RFCAuthor] RFC draft created at ${path}`);

      return { path, content, title: data.TITLE };
    };

    const produceOutline = async () => {
      const state = await StateManager.getAllArtifactMetadata();
      const artifactCount = Object.keys(state || {}).length;

      return {
        artifactCount,
        recentArtifacts: await gatherRecentContext(10),
        suggestedSections: [
          '## Metrics Impact',
          '## Rollout Plan',
          '## Backout Strategy',
          '## Dependencies'
        ]
      };
    };

    return {
      api: {
        draftRFC,
        produceOutline
      }
    };
  }
};

export default RFCAuthor;
