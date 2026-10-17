const ext = globalThis.browser || globalThis.chrome;

function openWelcome() {
  try {
    ext.tabs.create({ url: ext.runtime.getURL("welcome.html") });
  } catch {}
}

ext.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") openWelcome();
});

if (ext.action && ext.action.onClicked) {
  ext.action.onClicked.addListener(openWelcome);
}
