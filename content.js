(() => {
  const IMG_SIDE = 40;
  const VIDEO_SIDE = 32;
  const VIDEO_GENS = 2;
  const PROXIMITY = 6;
  const MAX_SOURCE = 512;
  const MIN_PIXELS = 8;
  const ext = globalThis.browser || globalThis.chrome;

  let enginePromise = null;

  function engine() {
    if (enginePromise) return enginePromise;
    enginePromise = (async () => {
      const b64 = globalThis.__LABRONIFY_WASM_B64 || "";
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const { instance } = await WebAssembly.instantiate(bytes, { env: { labronify_frame: () => {} } });
      return instance.exports;
    })();
    return enginePromise;
  }

  async function reducePng(bytes, side) {
    const ex = await engine();
    const n = side * side;
    const dataPtr = ex.labronify_alloc(bytes.length);
    new Uint8Array(ex.memory.buffer, dataPtr, bytes.length).set(bytes);
    const extBytes = new TextEncoder().encode("png");
    const extPtr = ex.labronify_alloc(extBytes.length);
    new Uint8Array(ex.memory.buffer, extPtr, extBytes.length).set(extBytes);
    const out = ex.labronify_reduce(dataPtr, bytes.length, extPtr, extBytes.length, side, 0, 0, 1);
    ex.labronify_free(dataPtr, bytes.length);
    ex.labronify_free(extPtr, extBytes.length);
    if (!out) return null;
    const grid = new Uint8Array(ex.memory.buffer, out, n * 3).slice();
    ex.labronify_free(out, n * 3);
    return grid;
  }

  async function solveGrid(grid, side, prev) {
    const ex = await engine();
    const n = side * side;
    const gPtr = ex.labronify_alloc(n * 3);
    new Uint8Array(ex.memory.buffer, gPtr, n * 3).set(grid);
    let out;
    if (prev) {
      const pPtr = ex.labronify_alloc(n * 4);
      new Uint8Array(ex.memory.buffer, pPtr, n * 4).set(new Uint8Array(prev.buffer, prev.byteOffset, n * 4));
      out = ex.labronify_solve_warm(gPtr, side, PROXIMITY, pPtr, VIDEO_GENS);
      ex.labronify_free(pPtr, n * 4);
    } else {
      out = ex.labronify_solve(gPtr, side, PROXIMITY);
    }
    ex.labronify_free(gPtr, n * 3);
    if (!out) return null;
    const raw = new Uint8Array(ex.memory.buffer, out, n * 4).slice();
    ex.labronify_free(out, n * 4);
    return new Uint32Array(raw.buffer);
  }

  function box(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  function paint(grid, assign, side) {
    const c = box(side, side);
    const ctx = c.getContext("2d");
    const id = ctx.createImageData(side, side);
    for (let t = 0; t < side * side; t++) {
      const s = assign[t] * 3;
      id.data[t * 4] = grid[s];
      id.data[t * 4 + 1] = grid[s + 1];
      id.data[t * 4 + 2] = grid[s + 2];
      id.data[t * 4 + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    return c;
  }

  function stretch(source, w, h) {
    const c = box(w, h);
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, c.width, c.height);
    return c;
  }

  function cover(source, w, h) {
    const c = box(w, h);
    const ctx = c.getContext("2d");
    const r = Math.max(c.width / source.width, c.height / source.height);
    const dw = source.width * r;
    const dh = source.height * r;
    ctx.drawImage(source, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
    return c;
  }

  function shrink(el, natW, natH) {
    const k = Math.min(1, MAX_SOURCE / Math.max(natW, natH));
    return stretch(el, natW * k, natH * k);
  }

  function bytesOf(c) {
    return new Promise((resolve) => {
      try {
        c.toBlob((b) => {
          if (!b) return resolve(null);
          b.arrayBuffer().then((a) => resolve(new Uint8Array(a)), () => resolve(null));
        }, "image/png");
      } catch {
        resolve(null);
      }
    });
  }

  async function cellsFor(source, side, prev) {
    const bytes = await bytesOf(source);
    if (!bytes) return null;
    const grid = await reducePng(bytes, side);
    if (!grid) return null;
    const assign = await solveGrid(grid, side, prev);
    if (!assign) return null;
    return { grid, assign };
  }

  function load(url) {
    return new Promise((resolve) => {
      if (!url || url.startsWith("data:") || url.startsWith("blob:")) return resolve(null);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  let artPromise = null;
  function art() {
    if (!artPromise) {
      artPromise = new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        try {
          img.src = ext.runtime.getURL("lebron.png");
        } catch {
          resolve(null);
        }
      });
    }
    return artPromise;
  }

  async function pictureOver(el, w, h) {
    const img = await art();
    if (!img || !w || !h) return;
    const host = el.parentElement;
    if (!host) return;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    const c = cover(img, w, h);
    c.style.position = "absolute";
    c.style.left = el.offsetLeft + "px";
    c.style.top = el.offsetTop + "px";
    c.style.width = w + "px";
    c.style.height = h + "px";
    c.style.pointerEvents = "none";
    c.style.zIndex = "1";
    host.appendChild(c);
  }

  const queue = [];
  let pumping = false;
  function enqueue(job) {
    queue.push(job);
    pump();
  }
  async function pump() {
    if (pumping) return;
    pumping = true;
    while (queue.length) {
      try {
        await queue.shift()();
      } catch {}
      await new Promise((r) => setTimeout(r, 0));
    }
    pumping = false;
  }

  function lebronFill(s) {
    let out = "lebron";
    while (out.length < s.length) out += " lebron";
    return out.slice(0, Math.max(s.length, 6));
  }

  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "TITLE"]);
  const doneText = new WeakSet();

  function lebronText(root) {
    if (!root || (root.nodeType !== 1 && root.nodeType !== 9)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (doneText.has(node)) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      node.nodeValue = lebronFill(node.nodeValue);
      doneText.add(node);
    }
  }

  const doneImg = new WeakSet();
  const srcCache = new Map();

  function display(img) {
    let w = img.clientWidth;
    let h = img.clientHeight;
    if (!w || !h) {
      const k = Math.min(1, MAX_SOURCE / Math.max(img.naturalWidth, img.naturalHeight));
      w = Math.round(img.naturalWidth * k);
      h = Math.round(img.naturalHeight * k);
    }
    return [w, h];
  }

  function armImage(img) {
    if (doneImg.has(img)) return;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    if (!natW || !natH || natW < MIN_PIXELS || natH < MIN_PIXELS) return;
    doneImg.add(img);
    const [w, h] = display(img);
    if (Math.max(w, h) < MIN_PIXELS) return;
    enqueue(async () => {
      const key = img.currentSrc || img.src;
      try {
        const cached = srcCache.get(key);
        if (cached) return applyImage(img, cached);
        let cells = await cellsFor(shrink(img, natW, natH), IMG_SIDE, null);
        if (!cells) {
          const fresh = await load(key);
          if (fresh) cells = await cellsFor(shrink(fresh, fresh.naturalWidth, fresh.naturalHeight), IMG_SIDE, null);
        }
        if (!cells) return pictureOver(img, w, h);
        const url = stretch(paint(cells.grid, cells.assign, IMG_SIDE), w, h).toDataURL("image/png");
        if (key) {
          if (srcCache.size > 200) srcCache.clear();
          srcCache.set(key, url);
        }
        applyImage(img, url);
      } catch {
        pictureOver(img, w, h);
      }
    });
  }

  function applyImage(img, url) {
    const original = img.currentSrc || img.src;
    img.addEventListener(
      "error",
      function rescue() {
        img.removeEventListener("error", rescue);
        img.src = original;
        const [w, h] = display(img);
        pictureOver(img, w, h);
      },
      { once: true }
    );
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    img.src = url;
  }

  const doneVid = new WeakSet();

  function armVideo(video) {
    if (doneVid.has(video)) return;
    doneVid.add(video);
    if (video.readyState >= 2) runVideo(video);
    else video.addEventListener("loadeddata", () => runVideo(video), { once: true });
  }

  function runVideo(video) {
    if (video.dataset.lebronOn) return;
    video.dataset.lebronOn = "1";
    const overlay = box(1, 1);
    overlay.style.position = "fixed";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "2147483646";
    (document.body || document.documentElement).appendChild(overlay);
    const ctx = overlay.getContext("2d");
    let prev = null;
    let busy = false;
    let done = false;

    async function drawFlat() {
      const img = await art();
      if (!img) return;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.drawImage(cover(img, overlay.width, overlay.height), 0, 0);
    }

    async function tick() {
      if (!video.isConnected) {
        overlay.remove();
        return;
      }
      const r = video.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight) {
        overlay.style.left = r.left + "px";
        overlay.style.top = r.top + "px";
        if (overlay.width !== Math.round(r.width) || overlay.height !== Math.round(r.height)) {
          overlay.width = Math.round(r.width);
          overlay.height = Math.round(r.height);
        }
        if (!busy && !done) {
          if (!video.videoWidth) {
            busy = false;
          } else {
            busy = true;
            try {
              const cells = await cellsFor(shrink(video, video.videoWidth, video.videoHeight), VIDEO_SIDE, prev);
              if (cells) {
                prev = cells.assign;
                ctx.clearRect(0, 0, overlay.width, overlay.height);
                ctx.drawImage(paint(cells.grid, cells.assign, VIDEO_SIDE), 0, 0, overlay.width, overlay.height);
              } else {
                await drawFlat();
                done = true;
              }
            } catch {
              await drawFlat();
              done = true;
            }
            busy = false;
          }
        }
      }
      setTimeout(tick, done ? 500 : 50);
    }
    tick();
  }

  function sweep(root, deep) {
    if (!root || (root.nodeType !== 1 && root.nodeType !== 9)) return;
    lebronText(root);
    const scope = root.querySelectorAll ? root : null;
    if (scope) {
      for (const img of scope.querySelectorAll("img")) armImage(img);
      for (const video of scope.querySelectorAll("video")) armVideo(video);
      if (deep) for (const el of scope.querySelectorAll("*")) if (el.shadowRoot) sweep(el.shadowRoot, deep);
    }
    if (root.tagName === "IMG") armImage(root);
    if (root.tagName === "VIDEO") armVideo(root);
    if (root.shadowRoot) sweep(root.shadowRoot, deep);
  }

  let active = false;

  function boot() {
    if (active) return;
    active = true;
    sweep(document.documentElement, true);
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (node.nodeType === 1) sweep(node, false);
          else if (node.nodeType === 3 && node.parentNode) lebronText(node.parentNode);
        }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  function activate() {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }

  try {
    ext.storage.local.get("enabled").then(({ enabled }) => {
      if (enabled) activate();
    });
    ext.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.enabled && changes.enabled.newValue) activate();
    });
  } catch {}
})();
