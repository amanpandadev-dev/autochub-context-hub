// Auto-CHUB Outdated API Test Fixture
// Open this file in the Extension Development Host and run:
// - Auto-CHUB: Analyze Current File
// - Auto-CHUB: Apply All Latest Fixes

function testOpenAILegacyPattern(client, openai) {
  // Rule: openai-chat-completions
  openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: "Hello" }],
  });

  // Rule: openai-chat-completions (also matches client.chat.completions.create)
  client.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: "Ping" }],
  });

  // Rule: openai-create-chat-completion
  createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: "Legacy call" }],
  });
}

function testAxiosCancelToken(axios) {
  // Rule: axios-cancel-token
  const source = axios.CancelToken.source();
  return axios.get("/api/data", {
    cancelToken: source.token,
  });
}

function testNodeBufferLegacy(input) {
  // Rule: node-buffer-constructor
  const b = new Buffer(input);
  return b.toString("utf8");
}

function testReactLegacyRender(ReactDOM, App, rootEl) {
  // Rule: reactdom-render
  ReactDOM.render(App, rootEl);
}
