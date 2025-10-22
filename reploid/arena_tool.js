
/**
 * REPLOID Tool for Initiating the PAWS Arena Workflow.
 *
 * This file provides the client-side function to trigger the multi-agent
 * competitive verification workflow via the proxy server.
 */

/**
 * Initiates the multi-agent Arena competitive verification workflow.
 *
 * This function sends a request to the proxy server's /api/arena endpoint.
 * The proxy then spawns the paws-arena CLI script. The client can
 * poll for results or use WebSocket for real-time updates.
 *
 * @param {string} objective The high-level goal for the agents.
 * @returns {Promise<void>} A promise that resolves when the request is successfully sent.
 */
async function runPawsArenaWorkflow(objective) {
  console.log(`[PAWS] Initiating Arena workflow for objective: "${objective}"`);

  // Ensure there's a WebSocket connection to display the output.
  // The core REPLOID UI should already manage this.

  try {
    const response = await fetch('/api/arena', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ objective }),
    });

    if (response.status !== 202) {
      const errorData = await response.json();
      const errorMessage = `Failed to start Arena workflow: ${errorData.error || response.statusText}`;
      console.error('[PAWS] ' + errorMessage);
      // Optionally, display this error in the REPLOID UI.
      throw new Error(errorMessage);
    }

    // The server responds with 202 Accepted, meaning the process has started.
    console.log('[PAWS] Arena workflow initiated successfully. Listening for WebSocket logs...');
    // The REPLOID UI should already have a WebSocket listener. Add logic
    // to handle the 'ARENA_LOG', 'ARENA_ERROR', and 'ARENA_COMPLETE' messages
    // to display the output stream from the Python script.

  } catch (error) {
    console.error('[PAWS] Network or fetch error initiating Arena workflow:', error);
    // Optionally, display this error in the REPLOID UI.
    throw error; // Re-throw for further handling if necessary.
  }
}

/*
 * Example Usage & Integration:
 *
 * 1. Make sure this script is loaded in your main REPLOID index.html.
 *
 * 2. Integrate this function into the REPLOID command palette or a UI button.
 *
 * 3. Add a WebSocket message handler in the main UI to process the output:
 *
 *    websocket.onmessage = (event) => {
 *      const message = JSON.parse(event.data);
 *      switch (message.type) {
 *        case 'ARENA_LOG':
 *          // Append message.payload to a log view in the UI
 *          console.log('ARENA Log:', message.payload);
 *          break;
 *        case 'ARENA_ERROR':
 *          // Append the error to a log view, perhaps styled differently
 *          console.error('ARENA Error:', message.payload);
 *          break;
 *        case 'ARENA_COMPLETE':
 *          // Notify the user that the process is finished
 *          console.log(`ARENA Complete. Exit code: ${message.payload.exitCode}`);
 *          break;
 *        // ... other message types
 *      }
 *    };
 *
 * 4. Call the function when desired:
 *
 *    runPawsArenaWorkflow("Implement a new sorting algorithm in the utils module.");
 */
