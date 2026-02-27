// static/js/main.js
document.addEventListener("DOMContentLoaded", function () {
  // =========================
  // Helpers
  // =========================
  const $ = (id) => document.getElementById(id);
  const show = (el, display = "block") => el && (el.style.display = display);
  const hide = (el) => el && (el.style.display = "none");
  const setText = (el, t) => el && (el.textContent = t);

  // =========================
  // Detect device
  // =========================
  const isMobile = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;

  const mobileCameraWrap = $("mobileCameraWrap");
  const laptopWebcamSection = $("laptopWebcamSection");
  const laptopDivider = $("laptopDivider");
  const hintText = $("hintText");

  if (isMobile) {
    hide(laptopWebcamSection);
    hide(laptopDivider);
    setText(hintText, "Use “Scan from Camera” or upload an image.");
  } else {
    hide(mobileCameraWrap);
    setText(hintText, "Use “Live Camera Scan” below or upload an image.");
  }

  // =========================
  // Scan page elements
  // =========================
  let cameraStream = null;

  const video = $("video");
  const canvas = $("canvas");
  const preview = $("preview");

  const cameraInput = $("cameraInput");
  const uploadInput = $("uploadInput");
  const capturedFileInput = $("capturedFileInput");
  const analyzeBtn = $("analyzeBtn");
  const scanForm = $("scanForm");

  function showPreview(src) {
    if (!preview) return;
    preview.src = src;
    show(preview, "block");
    preview.style.opacity = "0";
    preview.style.transform = "translateY(6px)";
    preview.style.transition = "opacity .25s ease, transform .25s ease";
    requestAnimationFrame(() => {
      preview.style.opacity = "1";
      preview.style.transform = "translateY(0)";
    });
  }

  // =========================
  // Toasts
  // =========================
  const toastHost = document.createElement("div");
  toastHost.id = "toastHost";
  document.body.appendChild(toastHost);

  function toast(message, type = "info", ms = 2400) {
    const t = document.createElement("div");
    t.className = `toast toast--${type}`;
    t.textContent = message;
    toastHost.appendChild(t);
    requestAnimationFrame(() => t.classList.add("toast--show"));
    setTimeout(() => {
      t.classList.remove("toast--show");
      setTimeout(() => t.remove(), 220);
    }, ms);
  }

  // =========================
  // Loading Overlay + Progress
  // =========================
  // Only create overlay if scan form exists (prevents clutter on other pages)
  let overlay = null;
  let progressFill = null;
  let progressPct = null;
  let progressHint = null;
  let progressTimer = null;

  function ensureOverlay() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.id = "loadingOverlay";
    overlay.innerHTML = `
      <div class="loadingCard">
        <div class="spinner" aria-hidden="true"></div>
        <div class="loadingText">
          <div class="loadingTitle">Analyzing…</div>
          <div class="loadingSub">BinGenie is inspecting the image.</div>

          <div class="progressWrap" aria-hidden="true">
            <div class="progressBar">
              <div class="progressFill" id="progressFill"></div>
            </div>
            <div class="progressMeta">
              <span id="progressPct">0%</span>
              <span class="muted" id="progressHint">Optimizing image…</span>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // IMPORTANT: query AFTER appending
    progressFill = $("progressFill");
    progressPct = $("progressPct");
    progressHint = $("progressHint");
  }

  function startFakeProgress() {
    if (!progressFill || !progressPct || !progressHint) return;

    let p = 0;
    let phase = 0;
    progressFill.style.width = "0%";
    progressPct.textContent = "0%";
    progressHint.textContent = "Optimizing image…";

    progressTimer = setInterval(() => {
      const jitter = Math.random() * 2;

      if (p < 35) p += 7 + jitter;
      else if (p < 70) p += 3 + jitter;
      else if (p < 92) p += 1.2 + jitter;
      else p += 0.2;

      p = Math.min(p, 97);

      progressFill.style.width = `${p}%`;
      progressPct.textContent = `${Math.round(p)}%`;

      if (p > 20 && phase === 0) {
        phase = 1;
        progressHint.textContent = "Detecting object features…";
      } else if (p > 55 && phase === 1) {
        phase = 2;
        progressHint.textContent = "Running AI prediction…";
      } else if (p > 85 && phase === 2) {
        phase = 3;
        progressHint.textContent = "Finalizing result…";
      }
    }, 140);
  }

  function stopFakeProgress() {
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = null;
  }

  function setLoading(on) {
    if (!scanForm) return;
    ensureOverlay();

    if (on) {
      overlay.classList.add("show");
      if (analyzeBtn) {
        analyzeBtn.disabled = true;
        analyzeBtn.dataset.originalText = analyzeBtn.textContent;
        analyzeBtn.textContent = "Analyzing…";
      }
      startFakeProgress();
    } else {
      overlay.classList.remove("show");
      stopFakeProgress();
      if (analyzeBtn) {
        analyzeBtn.textContent = analyzeBtn.dataset.originalText || "Analyze";
      }
    }
  }

  // =========================
  // Laptop webcam flow
  // =========================
  if (!isMobile && video && canvas && uploadInput && capturedFileInput && analyzeBtn) {
    const startCamBtn = $("startCamBtn");
    const captureBtn = $("captureBtn");
    const stopCamBtn = $("stopCamBtn");

    async function startCamera() {
      if (cameraStream) return;
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = cameraStream;
        show(video, "block");
        if (captureBtn) captureBtn.disabled = false;
        if (stopCamBtn) stopCamBtn.disabled = false;
        toast("Webcam started. Capture when ready.", "success");
      } catch (err) {
        console.log(err);
        toast("Could not access webcam. Check permissions.", "error", 3200);
        alert("Could not access webcam. Please allow permission and try again.");
      }
    }

    function stopCamera() {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
        cameraStream = null;
      }
      video.srcObject = null;
      hide(video);
      if (captureBtn) captureBtn.disabled = true;
      if (stopCamBtn) stopCamBtn.disabled = true;
    }

    function capturePhoto() {
      if (!cameraStream || !video.videoWidth) {
        toast("Camera not ready yet. Click Start Camera.", "error", 2800);
        return;
      }
      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      const dataUrl = canvas.toDataURL("image/png");
      showPreview(dataUrl);

      canvas.toBlob((blob) => {
        const file = new File([blob], "capture.png", { type: "image/png" });
        const dt = new DataTransfer();
        dt.items.add(file);
        capturedFileInput.files = dt.files;

        if (cameraInput) cameraInput.value = "";
        uploadInput.value = "";

        analyzeBtn.disabled = false;

        stopCamera();
        toast("Photo captured. Click Analyze.", "success");
      }, "image/png");
    }

    startCamBtn && startCamBtn.addEventListener("click", startCamera);
    captureBtn && captureBtn.addEventListener("click", capturePhoto);
    stopCamBtn && stopCamBtn.addEventListener("click", stopCamera);

    window.addEventListener("beforeunload", () => {
      if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
    });
  }

  // =========================
  // Mobile camera input
  // =========================
  if (cameraInput) {
    cameraInput.addEventListener("change", () => {
      const file = cameraInput.files?.[0];
      if (!file) return;

      if (capturedFileInput) capturedFileInput.value = "";
      if (uploadInput) uploadInput.value = "";

      showPreview(URL.createObjectURL(file));
      if (analyzeBtn) analyzeBtn.disabled = false;

      toast("Photo selected. Click Analyze.", "success");
    });
  }

  // =========================
  // Upload input
  // =========================
  if (uploadInput) {
    uploadInput.addEventListener("change", () => {
      const file = uploadInput.files?.[0];
      if (!file) return;

      if (capturedFileInput) capturedFileInput.value = "";
      if (cameraInput) cameraInput.value = "";

      showPreview(URL.createObjectURL(file));
      if (analyzeBtn) analyzeBtn.disabled = false;

      toast("Image uploaded. Click Analyze.", "success");
    });
  }

  // =========================
  // Form submit: SHOW overlay for a moment (so you SEE the progress)
  // =========================
  let submitting = false;

  if (scanForm) {
    scanForm.addEventListener("submit", (e) => {
      if (submitting) return; // prevent double submit loop

      const hasUpload =
        (uploadInput && uploadInput.files && uploadInput.files.length > 0) ||
        (cameraInput && cameraInput.files && cameraInput.files.length > 0) ||
        (capturedFileInput && capturedFileInput.files && capturedFileInput.files.length > 0);

      if (!hasUpload) {
        toast("Please choose an image first.", "error", 3000);
        e.preventDefault();
        return;
      }

      // IMPORTANT: prevent default, show overlay, then submit after delay
      e.preventDefault();
      setLoading(true);

      // Hold the user for a short time so it's satisfying
      setTimeout(() => {
        submitting = true;
        scanForm.submit();
      }, 650);
    });
  }

  // =========================
  // Confetti ONLY when result is "Recycle"
  // =========================
  function isRecycleResultOnPage() {
    const h2 = document.querySelector(".result h2");
    if (!h2) return false;
    return h2.textContent.toLowerCase().includes("recycle");
  }

  function launchConfetti(durationMs = 2200) {
    const c = document.createElement("canvas");
    c.id = "confettiCanvas";
    document.body.appendChild(c);

    const ctx = c.getContext("2d");
    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    function resize() {
      c.width = Math.floor(window.innerWidth * DPR);
      c.height = Math.floor(window.innerHeight * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();

    const colors = ["#10b981", "#0ea5e9", "#f59e0b", "#a78bfa", "#ef4444", "#22c55e"];
    const pieces = [];
    const count = 170;

    for (let i = 0; i < count; i++) {
      pieces.push({
        x: Math.random() * window.innerWidth,
        y: -20 - Math.random() * 200,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        vx: -3 + Math.random() * 6,
        vy: 3 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: -0.15 + Math.random() * 0.3,
        color: colors[(Math.random() * colors.length) | 0],
        a: 0.95
      });
    }

    const start = performance.now();

    function tick(now) {
      const t = now - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.035;
        p.rot += p.vr;
        p.a = Math.max(0, 0.95 - t / durationMs);

        ctx.save();
        ctx.globalAlpha = p.a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (t < durationMs) requestAnimationFrame(tick);
      else {
        c.remove();
        window.removeEventListener("resize", resize);
      }
    }

    window.addEventListener("resize", resize);
    requestAnimationFrame(tick);
  }

  if (isRecycleResultOnPage()) {
    setTimeout(() => {
      toast("Nice! That goes in recycling ♻️", "success", 2600);
      launchConfetti(2200);
    }, 450);
  }
});