let messageCallbacks = {};
let messageIdCounter = 0;

self.onmessage = async (event) => {
  const { type, payload, id, data, error } = event.data;

  if (type === "init") {
    const { toolCode, toolArgs } = payload;
    try {
      const AsyncFunction = Object.getPrototypeOf(
        async function () {}
      ).constructor;
      const func = new AsyncFunction(
        "params",
        "LS",
        "StateManager",
        toolCode + "\n\nreturn await run(params);"
      );
      const result = await func(toolArgs, self.LS_shim, self.StateManager_shim);
      self.postMessage({ success: true, result: result });
    } catch (e) {
      const errorDetail = {
        message: e.message || "Unknown worker execution error",
        stack: e.stack,
        name: e.name,
      };
      self.postMessage({ success: false, error: errorDetail });
    }
  } else if (type === "response") {
    const callback = messageCallbacks[id];
    if (callback) {
      if (error) {
        callback.reject(
          new Error(error.message || "Worker shim request failed")
        );
      } else {
        callback.resolve(data);
      }
      delete messageCallbacks[id];
    }
  }
};

function makeShimRequest(requestType, payload) {
  return new Promise((resolve, reject) => {
    const id = messageIdCounter++;
    messageCallbacks[id] = { resolve, reject };
    self.postMessage({
      type: "request",
      id: id,
      requestType: requestType,
      payload: payload,
    });
  });
}

self.LS_shim = {
  getArtifactContent: (id, cycle, versionId = null) => {
    if (
      typeof id !== "string" ||
      typeof cycle !== "number" ||
      (versionId !== null && typeof versionId !== "string")
    ) {
      return Promise.reject(
        new Error("Invalid arguments for getArtifactContent")
      );
    }
    return makeShimRequest("getArtifactContent", { id, cycle, versionId });
  },
};

self.StateManager_shim = {
  getArtifactMetadata: (id, versionId = null) => {
    if (
      typeof id !== "string" ||
      (versionId !== null && typeof versionId !== "string")
    ) {
      return Promise.reject(
        new Error("Invalid arguments for getArtifactMetadata")
      );
    }
    return makeShimRequest("getArtifactMetadata", { id, versionId });
  },
  getArtifactMetadataAllVersions: (id) => {
    if (typeof id !== "string") {
      return Promise.reject(
        new Error("Invalid arguments for getArtifactMetadataAllVersions")
      );
    }
    return makeShimRequest("getArtifactMetadataAllVersions", { id });
  },
  getAllArtifactMetadata: () => {
    return makeShimRequest("getAllArtifactMetadata", {});
  },
};