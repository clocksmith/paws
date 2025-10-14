# Blueprint 0x00001A: RFC Authoring

**Objective:** To define the structure, tone, and required components for a standard Request for Change document.

**Prerequisites:** 0x000012 (Structured Self-Evaluation)

**Affected Artifacts:** `/docs/rfc-*.md`, `/templates/rfc.md`

---

## 1. The Strategic Imperative

To ensure project changes are well-documented, reviewed, and aligned with strategic goals, a formal RFC process is necessary. This blueprint provides the knowledge to automate the drafting of these documents.

The RFC process serves multiple critical functions:
- **Alignment**: Ensures proposed changes align with project vision and technical architecture
- **Documentation**: Creates a historical record of decisions and their rationale
- **Review**: Enables stakeholder feedback before implementation
- **Risk Management**: Identifies potential issues and mitigation strategies early

## 2. The Architectural Solution

An RFC is a markdown document created from a standard template. It must contain specific sections that address different stakeholder concerns. The agent's role is to analyze a proposed change and populate these sections with concise, evidence-based information.

### Core RFC Structure:

1. **Title**: Clear, descriptive summary of the change (50 chars max)
2. **Metadata**: Author, date, status, and review timeline
3. **Background**: Context and problem statement (2-3 paragraphs)
4. **Goals**: Specific, measurable outcomes (3-5 bullet points)
5. **Technical Scope**: Implementation details and affected systems
6. **Deliverables**: Concrete outputs and success criteria
7. **Risks & Mitigations**: Potential issues and prevention strategies
8. **Approval**: Review and sign-off requirements

### Tone Guidelines:

- **Professional**: Use formal but accessible language
- **Objective**: Present facts and data, minimize subjective opinions
- **Concise**: Each section should be thorough but brief
- **Structured**: Use consistent formatting and clear hierarchies

## 3. The Implementation Pathway

### 3.1 RFC Creation Workflow:

1. **Initiate**: Use the `create_rfc` tool with a descriptive title
2. **Read**: Load the newly created RFC draft file
3. **Analyze**: Gather context from:
   - Project state and recent changes
   - User requirements or feature requests
   - Existing blueprints and documentation
   - Current system architecture
4. **Populate**: Systematically fill each section:
   - Background: Analyze current state and identify gaps
   - Goals: Extract from user input or infer from analysis
   - Technical Scope: List specific files, modules, and changes
   - Deliverables: Define measurable outputs
   - Risks: Consider performance, security, compatibility
5. **Review**: Use the `self_evaluate` tool to assess:
   - Clarity and completeness
   - Technical accuracy
   - Alignment with project standards
6. **Refine**: Incorporate evaluation feedback
7. **Present**: Save final version and notify user

### 3.2 Quality Checklist:

Before finalizing an RFC, verify:
- [ ] Title accurately summarizes the change
- [ ] Background provides sufficient context
- [ ] Goals are SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- [ ] Technical scope identifies all affected components
- [ ] Risks are realistic and mitigations are actionable
- [ ] Document follows markdown best practices
- [ ] All placeholders have been replaced with content

### 3.3 Advanced Techniques:

**Change Impact Analysis**:
- Use `read_artifact` to examine affected files
- Analyze dependency chains with blueprint cross-references
- Estimate implementation complexity based on scope

**Automated Goal Extraction**:
- Parse user input for action verbs and outcomes
- Identify implicit goals from problem descriptions
- Prioritize goals based on strategic alignment

**Risk Assessment Matrix**:
- Technical risks: Performance, scalability, compatibility
- Process risks: Timeline, resource availability, dependencies
- Business risks: User impact, cost, strategic alignment

## 4. Integration Points

### Tools Integration:
- `create_rfc`: Initializes RFC from template
- `read_artifact`: Analyzes existing code and documentation
- `write_artifact`: Saves completed RFC
- `self_evaluate`: Reviews RFC quality

### Blueprint Dependencies:
- 0x000012: Provides self-evaluation framework
- 0x000018: Offers meta-blueprint creation patterns
- 0x000009: Supplies pure logic for analysis

### Persona Compatibility:
- **RFC Author**: Primary persona for this blueprint
- **Code Refactorer**: Can use RFCs to document refactoring plans
- **RSI Lab Sandbox**: Can practice RFC creation as a learning exercise

## 5. Example RFC Snippets

### Well-Written Background:
```markdown
### Background

The current REPLOID system initializes with a developer-centric interface that requires 
deep technical knowledge to operate effectively. User feedback from Q2 testing revealed 
that 78% of non-technical stakeholders struggled with the initial configuration process, 
leading to a 45% drop-off rate within the first session.

This friction point significantly limits adoption among our target user base of product 
managers, designers, and content creators who would benefit from AI-assisted prototyping 
but lack the technical expertise to navigate complex configuration wizards.
```

### Clear Goals Section:
```markdown
### Goals

- Reduce first-session drop-off rate from 45% to under 15%
- Enable non-technical users to start productive work within 2 minutes
- Maintain full functionality for power users via progressive disclosure
- Achieve 80% user satisfaction score in onboarding surveys
- Complete implementation by end of Q3
```

## 6. Meta-Considerations

This blueprint itself demonstrates RFC principles:
- Clear structure with numbered sections
- Specific, actionable guidance
- Integration with existing systems
- Measurable success criteria

When creating new RFCs, the agent should:
1. Reference this blueprint for structural guidance
2. Adapt tone and depth to audience needs
3. Balance thoroughness with conciseness
4. Maintain consistency with prior RFCs in the project

## 7. Conclusion

RFC authoring is a critical meta-capability that enables the REPLOID system to document 
its own evolution. By following this blueprint, the agent can produce professional, 
actionable change proposals that facilitate both human review and automated implementation.

The RFC process transforms ad-hoc changes into structured, reviewable proposals that 
enhance project governance and maintain architectural coherence as the system grows.