# PAWS/REPLOID References & Citations

This document contains all external sources and research papers referenced in the PAWS/REPLOID documentation.

---

## AI Agent Research

### Context Engineering

**Anthropic (2025). "Effective context engineering for AI agents"**
- URL: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Published: September 29, 2025
- Key Findings:
  - Context engineering yields up to 54% gains in agent tasks
  - Context rot: model accuracy decreases as context window size increases
  - Combining Memory Tool with Context Editing improved search performance by 39%
  - Token consumption reduced by 84% in 100-round web search tasks
- Referenced in: `reploid/README.md` (line 31)

**Related Coverage:**
- The Decoder: [Anthropic claims context engineering beats prompt engineering](https://the-decoder.com/anthropic-claims-context-engineering-beats-prompt-engineering-when-managing-ai-agents/)
- Medium: [Context Is the New Prompt](https://medium.com/data-science-collective/context-is-the-new-prompt-why-context-engineering-is-shaping-the-future-of-ai-46eb062ed270)

### Multi-Agent Systems

**Anthropic (2025). "How we built our multi-agent research system"**
- URL: https://www.anthropic.com/engineering/multi-agent-research-system
- Describes multi-agent coordination and deliberation strategies

**Anthropic (2025). "Writing effective tools for AI agents—using AI agents"**
- URL: https://www.anthropic.com/engineering/writing-tools-for-agents
- Best practices for tool design and agent capabilities

---

## WebRTC & Networking

### Security & Encryption

**WebRTC Security Study (2023). "A Study of WebRTC Security"**
- URL: https://webrtc-security.github.io/
- Comprehensive analysis of WebRTC security architecture
- Key Points:
  - Encryption is mandatory in WebRTC specification
  - Data channels use DTLS (Datagram Transport Layer Security)
  - Media streams use SRTP (Secure Real-time Transport Protocol)
- Referenced in: `reploid/docs/WEBRTC_SETUP.md` (line 394)

**Ant Media (2024). "WebRTC Security Guide: Encryption, SRTP & DTLS Explained"**
- URL: https://antmedia.io/webrtc-security/
- Detailed explanation of DTLS-SRTP key exchange
- Referenced in: `reploid/docs/WEBRTC_SETUP.md` (line 395)

**WebRTC for the Curious. "Securing"**
- URL: https://webrtcforthecurious.com/docs/04-securing/
- Open-source book chapter on WebRTC security fundamentals

**Bouchaara, S. (2024). "A Deep Dive into WebRTC's DTLS-SRTP"**
- URL: https://soufianebouchaara.com/a-deep-dive-into-webrtcs-dtls-srtp-securing-real-time-communication/
- Technical deep dive into DTLS-SRTP handshake process

**QuickBlox (2024). "Understanding WebRTC Security and Encryption"**
- URL: https://quickblox.com/blog/webrtc-security-and-encryption/
- Developer-friendly security overview

**MirrorFly (2025). "WebRTC Encryption and Security - All You Need to Know"**
- URL: https://www.mirrorfly.com/blog/webrtc-encryption-and-security/
- Current best practices for 2025

### Protocol Specifications

**IETF RFC 5389. "Session Traversal Utilities for NAT (STUN)"**
- URL: https://datatracker.ietf.org/doc/html/rfc5389
- Official STUN protocol specification

**IETF RFC 5766. "Traversal Using Relays around NAT (TURN)"**
- URL: https://datatracker.ietf.org/doc/html/rfc5766
- Official TURN protocol specification

**IETF RFC 8827. "WebRTC Security Architecture"**
- URL: https://datatracker.ietf.org/doc/html/rfc8827
- W3C/IETF WebRTC security specification

### Implementation Resources

**WebRTC Samples**
- URL: https://webrtc.github.io/samples/
- Official WebRTC code examples and demos

**Coturn Project**
- URL: https://github.com/coturn/coturn
- Open-source TURN/STUN server implementation

**Trickle ICE Test**
- URL: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
- Tool for testing STUN/TURN connectivity

---

## Browser APIs & WebGPU

### WebGPU Specification

**W3C WebGPU Working Group. "Implementation Status"**
- URL: https://github.com/gpuweb/gpuweb/wiki/Implementation-Status
- Official WebGPU implementation status across browsers

**Can I Use. "WebGPU Browser Support"**
- URL: https://caniuse.com/webgpu
- Real-time browser compatibility data
- Current Support (2025):
  - Chrome 113+ (released April 2023)
  - Edge 113+ (released April 2023)
  - Safari: Limited support (macOS only)
  - Firefox: Experimental flag required
- Referenced in: `reploid/README.md` (line 322)

**Chrome for Developers. "Chrome ships WebGPU"**
- URL: https://developer.chrome.com/blog/webgpu-release
- Official announcement and requirements
- Published: April 2023

**Chrome for Developers. "Overview of WebGPU"**
- URL: https://developer.chrome.com/docs/web-platform/webgpu/overview
- Comprehensive WebGPU guide

**Chrome for Developers. "WebGPU: Troubleshooting tips and fixes"**
- URL: https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips
- Common issues and solutions

**Markaicode. "WebGPU 2.0: Beating Native Graphics Performance in Chrome 2025"**
- URL: https://markaicode.com/webgpu-2-chrome-2025-performance/
- Performance benchmarks and optimization techniques

### Browser Compatibility Testing

**LambdaTest. "Cross Browser Compatibility Score of WebGPU"**
- URL: https://www.lambdatest.com/web-technologies/webgpu
- Cross-browser testing data

**Wikipedia. "WebGPU"**
- URL: https://en.wikipedia.org/wiki/WebGPU
- Historical context and technical overview

---

## Distributed Systems & Consensus

### Paxos Algorithm

**Lamport, L. (1998). "The Part-Time Parliament"**
- Original Paxos paper (Byzantine Generals Problem)
- Foundation for PAWS multi-agent consensus

**Lamport, L. (2001). "Paxos Made Simple"**
- Simplified explanation of Paxos algorithm
- Used in `py/paws_paxos.py` implementation

---

## Machine Learning Models

### Local LLM Resources

**WebLLM Project**
- URL: https://github.com/mlc-ai/web-llm
- Browser-native LLM inference via WebGPU
- Used in: `reploid/upgrades/local-llm.js`

**MLC LLM Project**
- URL: https://mlc.ai/mlc-llm/
- Machine Learning Compilation for LLMs
- Provides quantized models for browser deployment

**Models Used in REPLOID:**
- Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC (~900MB)
- Phi-3.5-mini-instruct-q4f16_1-MLC (~1.2GB)
- Llama-3.2-1B-Instruct-q4f16_1-MLC (~1GB)
- gemma-2-2b-it-q4f16_1-MLC (~1.3GB)

### Ollama

**Ollama Project**
- URL: https://ollama.ai
- Local LLM runtime for desktop
- Supports 70+ models including Llama, Mistral, Codellama

---

## Development Tools

### Testing Frameworks

**Vitest**
- URL: https://vitest.dev/
- Next-generation testing framework
- Used for: `reploid/tests/*.test.js`

**Playwright**
- URL: https://playwright.dev/
- End-to-end testing framework
- Used for: `reploid/tests/e2e/*.spec.js`

### Code Quality

**Acorn**
- URL: https://github.com/acornjs/acorn
- JavaScript parser for AST analysis
- Used in: `reploid/upgrades/ast-visualizer.js`

**D3.js**
- URL: https://d3js.org/
- Data visualization library
- Used for FSM and module graph visualizations

---

## Git Integration

**Simple-git**
- URL: https://github.com/steveukx/git-js
- Node.js interface for Git
- Used for worktree management and VCS operations

---

## Related Research

### Recursive Self-Improvement

**Schmidhuber, J. (2003). "Gödel Machines: Self-Referential Universal Problem Solvers"**
- Theoretical foundation for self-improving AI systems

**Russell, S. & Norvig, P. (2021). "Artificial Intelligence: A Modern Approach" (4th ed.)**
- Chapter on agent architectures and meta-reasoning

### Context Windows & RAG

**Lewis, P. et al. (2020). "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks"**
- Foundation for context retrieval strategies

**Gao, L. et al. (2023). "Precise Zero-Shot Dense Retrieval without Relevance Labels"**
- Embedding-based context selection

---

## Standards & Specifications

### Web Standards

**W3C. "Web Real-Time Communications (WebRTC)"**
- URL: https://www.w3.org/TR/webrtc/
- Official WebRTC specification

**W3C. "WebGPU Specification"**
- URL: https://www.w3.org/TR/webgpu/
- Official WebGPU specification

**WHATWG. "Streams Standard"**
- URL: https://streams.spec.whatwg.org/
- Used for streaming LLM responses

---

## License & Attribution

All external sources are cited under fair use for educational and research purposes. Trademarks and copyrights belong to their respective owners.

**PAWS/REPLOID** is MIT licensed. See LICENSE file for details.

---

*Last Updated: 2025-10-15*
*Maintained by: PAWS/REPLOID Documentation Team*
