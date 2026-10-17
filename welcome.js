const ext = globalThis.browser || globalThis.chrome;
const btn = document.getElementById("go");
const store = ext && ext.storage && ext.storage.local;

if (store) {
  store.get("enabled").then(({ enabled }) => {
    if (enabled) btn.textContent = "lebronifying the internet";
  });
}

btn.addEventListener("click", () => {
  btn.textContent = "lebronifying the internet";
  if (store) store.set({ enabled: true });
});
