(() => {
  "use strict";

  const DATA_ROOT = "static-demo/data/";
  const MODEL_ID = "flex-arm-ft";
  const TASK_LABELS = {
    text_to_image: "Text → Image",
    image_captioning: "Image → Text",
    interpolation: "Interpolation",
    latent_arithmetic: "Latent arithmetic",
  };
  const DEFAULT_EXAMPLE_INDEX = { text_to_image: 2 };

  const state = {
    manifest: null,
    plan: null,
    task: "text_to_image",
    exampleIndex: 0,
    kIndex: 0,
    pointIndex: 0,
  };

  const byId = (id) => document.getElementById(id);
  const stage = byId("flat-demo-stage");
  const examples = byId("flat-demo-examples");
  const slider = byId("flat-demo-k");
  const kOutput = byId("flat-demo-k-output");
  const ticks = byId("flat-demo-ticks");
  const status = byId("flat-demo-status");

  if (!stage || !examples || !slider || !kOutput || !ticks || !status) return;

  const record = (key) => state.manifest.records[key] || null;
  const assetUrl = (entry) => entry && entry.path ? DATA_ROOT + entry.path : "";
  const taskConfig = () => state.plan.tasks[state.task];
  const currentExample = () => taskConfig().examples[state.exampleIndex];
  const kValues = () => taskConfig().k_values;
  const currentK = () => kValues()[state.kIndex];

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function imageMarkup(src, alt) {
    if (!src) {
      return `<div class="flat-demo-placeholder">Output is not available yet.</div>`;
    }
    return `<img src="${src}" alt="${escapeHtml(alt)}" loading="eager">`;
  }

  function displayCaption(value) {
    const caption = String(value || "").trim();
    if (!caption) return "Output is not available yet.";
    return /[.!?]$/.test(caption) ? caption : caption + "…";
  }

  function pairMarkup({ leftTitle, image, imageAlt, promptLabel, prompt, rightTitle, caption, meta, extras = "" }) {
    const k = currentK();
    return `${extras}<div class="flat-demo-pair">
      <article class="flat-demo-card flat-demo-visual-card">
        <div class="flat-demo-card-head"><span>${leftTitle}</span><span class="flat-demo-k-badge">K = ${k}</span></div>
        <div class="flat-demo-image-wrap">${imageMarkup(image, imageAlt)}</div>
        <div class="flat-demo-copy">
          <span class="flat-demo-label">${promptLabel}</span>
          <p>${escapeHtml(prompt)}</p>
        </div>
      </article>
      <div class="flat-demo-bridge" aria-hidden="true"><span></span><strong>same prefix</strong><span></span></div>
      <article class="flat-demo-card flat-demo-text-card">
        <div class="flat-demo-card-head"><span>${rightTitle}</span><span class="flat-demo-k-badge">K = ${k}</span></div>
        <div class="flat-demo-caption-wrap"><span class="flat-demo-quote">“</span><p id="flat-demo-caption">${escapeHtml(displayCaption(caption))}</p></div>
        <div class="flat-demo-copy flat-demo-caption-meta">
          <span class="flat-demo-label">Decoded caption</span>
          <p>${escapeHtml(meta)}</p>
        </div>
      </article>
    </div>`;
  }

  function renderTextToImage(example, k) {
    const imageEntry = record(`${MODEL_ID}/text_to_image/${example.id}/k${k}`);
    const captionEntry = record(`${MODEL_ID}/text_to_image/${example.id}/caption/k${k}`);
    stage.innerHTML = pairMarkup({
      leftTitle: "Generated image",
      image: assetUrl(imageEntry),
      imageAlt: `Generated image for ${example.prompt} at K=${k}`,
      promptLabel: "Input prompt",
      prompt: example.prompt,
      rightTitle: "Decoded text",
      caption: captionEntry && captionEntry.caption,
      meta: "Decoded from the same text representation used to generate the image.",
    });
  }

  function renderCaptioning(example, k) {
    const captionEntry = record(`${MODEL_ID}/image_captioning/${example.id}/k${k}`);
    stage.innerHTML = pairMarkup({
      leftTitle: "Input image",
      image: assetUrl(captionEntry && { path: captionEntry.input_path }),
      imageAlt: example.label,
      promptLabel: "Input",
      prompt: example.label,
      rightTitle: "Generated text",
      caption: captionEntry && captionEntry.caption,
      meta: "Decoded from the truncated image representation.",
    });
  }

  function renderInterpolation(example, k) {
    const points = taskConfig().points;
    const cells = points.map((alpha, index) => {
      const imageEntry = record(`${MODEL_ID}/interpolation/${example.id}/k${k}/p${index}`);
      const captionEntry = record(`${MODEL_ID}/interpolation/${example.id}/k${k}/p${index}/caption`);
      return `<figure class="flat-demo-interp-cell">
        <div class="flat-demo-interp-alpha">α = ${alpha}</div>
        <div class="flat-demo-interp-image">${imageMarkup(
          assetUrl(imageEntry),
          `Interpolation from ${example.start} to ${example.end} at alpha ${alpha}`
        )}</div>
        <figcaption>${escapeHtml(displayCaption(captionEntry && captionEntry.caption))}</figcaption>
      </figure>`;
    }).join("");
    stage.innerHTML = `<div class="flat-demo-sequence">
      <div class="flat-demo-sequence-head">
        <span>${escapeHtml(example.start)}</span>
        <span class="flat-demo-sequence-arrow" aria-hidden="true">→</span>
        <span>${escapeHtml(example.end)}</span>
      </div>
      <div class="flat-demo-interp-grid">${cells}</div>
      <div class="flat-demo-sequence-note">Decoded captions are shown beneath their corresponding generated images.</div>
    </div>`;
  }

  function renderArithmetic(example, k) {
    const stageIndex = example.terms.length - 1;
    const resultEntry = record(`${MODEL_ID}/latent_arithmetic/${example.id}/stage${stageIndex}/k${k}`);
    const captionEntry = record(`${MODEL_ID}/latent_arithmetic/${example.id}/final_caption/k${k}`);
    const operands = example.terms.map((term, index) => {
      const entry = record(`${MODEL_ID}/latent_arithmetic/${example.id}/term${index}/k${k}`);
      const source = assetUrl(entry);
      const isImage = term.modality === "image";
      const modality = isImage ? "Image input" : "Text input";
      const operator = index === 0 ? "" : `<span class="flat-demo-arith-operator" aria-hidden="true">${term.sign > 0 ? "+" : "−"}</span>`;
      return `${operator}<figure class="flat-demo-arith-cell">
        <div class="flat-demo-arith-head"><span>Input ${index + 1}</span><span>Decoded · K=${k}</span></div>
        <div class="flat-demo-arith-image">${imageMarkup(source, term.text)}</div>
        <figcaption><strong>${modality}</strong>${isImage ? escapeHtml(term.text) : `“${escapeHtml(term.text)}”`}</figcaption>
      </figure>`;
    }).join("");
    const modalities = [...new Set(example.terms.map((term) => term.modality === "image" ? "image" : "text"))];
    const modeLabel = example.operation_label || (modalities.length === 1 ? `${modalities[0]}–${modalities[0]}` : "image–text");
    stage.innerHTML = `<div class="flat-demo-arithmetic">
      <div class="flat-demo-arithmetic-meta">
        <span class="flat-demo-operation-badge">${escapeHtml(modeLabel)}</span>
        <span>Register-wise arithmetic in the shared representation space</span>
      </div>
      <div class="flat-demo-equation">
        ${operands}
        <span class="flat-demo-arith-operator flat-demo-arith-equals" aria-hidden="true">=</span>
        <figure class="flat-demo-arith-cell flat-demo-arith-result">
          <div class="flat-demo-arith-head"><span>Output</span><span>K = ${k}</span></div>
          <div class="flat-demo-arith-image">${imageMarkup(assetUrl(resultEntry), `Arithmetic result at K=${k}`)}</div>
          <figcaption><strong>Decoded caption</strong>${escapeHtml(displayCaption(captionEntry && captionEntry.caption))}</figcaption>
        </figure>
      </div>
    </div>`;
  }

  function renderStage() {
    const example = currentExample();
    const k = currentK();
    document.querySelectorAll("[data-flat-k]").forEach((el) => { el.textContent = `K = ${k}`; });
    kOutput.textContent = `K = ${k} · ${k * 64} dimensions`;
    slider.style.setProperty("--flat-demo-progress", `${state.kIndex / Math.max(kValues().length - 1, 1) * 100}%`);
    [...ticks.children].forEach((el, index) => el.classList.toggle("active", index === state.kIndex));

    if (state.task === "text_to_image") renderTextToImage(example, k);
    else if (state.task === "image_captioning") renderCaptioning(example, k);
    else if (state.task === "interpolation") renderInterpolation(example, k);
    else renderArithmetic(example, k);

    setStatus(`Precomputed output · ${TASK_LABELS[state.task]} · K=${k}`);
  }

  function renderExamples() {
    examples.innerHTML = taskConfig().examples.map((example, index) =>
      `<button class="flat-demo-example${index === state.exampleIndex ? " active" : ""}" type="button" data-example="${index}">${escapeHtml(example.label)}</button>`
    ).join("");
    examples.querySelectorAll("[data-example]").forEach((button) => {
      button.addEventListener("click", () => {
        state.exampleIndex = Number(button.dataset.example);
        renderExamples();
        renderStage();
      });
    });
  }

  function renderSlider() {
    const values = kValues();
    state.kIndex = Math.min(state.kIndex, values.length - 1);
    slider.max = String(values.length - 1);
    slider.value = String(state.kIndex);
    const denominator = Math.max(values.length - 1, 1);
    ticks.innerHTML = values.map((k, index) =>
      `<span style="left:${index / denominator * 100}%">${k}</span>`
    ).join("");
  }

  function selectTask(task) {
    state.task = task;
    state.exampleIndex = DEFAULT_EXAMPLE_INDEX[task] || 0;
    state.kIndex = taskConfig().k_values.length - 1;
    state.pointIndex = 0;
    document.querySelectorAll(".flat-demo-task").forEach((button) => {
      const active = button.dataset.task === task;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    renderExamples();
    renderSlider();
    renderStage();
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    })[character]);
  }

  async function loadDemo() {
    try {
      const [manifestResponse, planResponse] = await Promise.all([
        fetch(DATA_ROOT + "manifest.json"),
        fetch(DATA_ROOT + "source_plan.json"),
      ]);
      if (!manifestResponse.ok || !planResponse.ok) throw new Error("precomputed asset manifest is unavailable");
      state.manifest = await manifestResponse.json();
      state.plan = await planResponse.json();
      document.querySelectorAll(".flat-demo-task").forEach((button) => {
        button.addEventListener("click", () => selectTask(button.dataset.task));
      });
      slider.addEventListener("input", () => {
        state.kIndex = Number(slider.value);
        renderStage();
      });
      selectTask(state.task);
    } catch (error) {
      stage.innerHTML = `<div class="flat-demo-stage-loading">The static demo assets are being prepared for release.</div>`;
      examples.innerHTML = '<span class="flat-demo-loading">Examples unavailable</span>';
      slider.disabled = true;
      setStatus(error.message, true);
    }
  }

  loadDemo();
})();
