// Easter egg: drag the sun or moon around the sky wheel to change the time of
// day. Let go mid-swing and the wheel keeps turning, slowing to a stop.
// Nothing is saved, so a reload goes back to the visitor's clock.

const root = document.documentElement;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

// Glide slows by a factor of e every FRICTION_MS; a fling covers roughly
// speed * FRICTION_MS hours.
const FRICTION_MS = 700;
// Only movement in the last SAMPLE_MS before release counts towards the
// fling, so a drag that stops before letting go doesn't glide.
const SAMPLE_MS = 80;
// Hours per millisecond: about 2 days per second.
const MAX_SPEED = 0.05;
const MIN_SPEED = 0.0002;

// The hour the inline script in base.njk last set. 0 (midnight) is valid.
const readHour = (fallback) => {
  const value = parseFloat(root.style.getPropertyValue("--hour"));
  return Number.isNaN(value) ? fallback : value;
};

let hour = readHour(12);
let glide = 0;

const setHour = (value) => {
  hour = ((value % 24) + 24) % 24;
  window.setSkyHour(hour);
};

// Shortest signed step between two hours on the 24-hour wheel.
const hourDelta = (from, to) => ((to - from + 36) % 24) - 12;

const startGlide = (speed) => {
  let last = performance.now();
  const step = (now) => {
    const dt = now - last;
    last = now;
    setHour(hour + speed * dt);
    speed *= Math.exp(-dt / FRICTION_MS);
    glide = Math.abs(speed) > MIN_SPEED ? requestAnimationFrame(step) : 0;
  };
  glide = requestAnimationFrame(step);
};

for (const body of document.querySelectorAll(".scene__body")) {
  const topHour = Number(body.dataset.topHour);
  // Recent { time, hour } pairs, with hour unwrapped so it can pass 24.
  let samples = [];

  const pointerHour = (event) => {
    // Wheel geometry in pixels; the --wheel-* properties are registered <length>s.
    const style = getComputedStyle(root);
    const [cx, cy, rx, ry] = ["cx", "cy", "rx", "ry"].map((key) =>
      parseFloat(style.getPropertyValue(`--wheel-${key}`)),
    );
    // 0 is straight up, clockwise positive, one full turn is 24 hours. Scaling
    // by the radii turns the ellipse back into a circle first.
    const angle = Math.atan2((event.clientX - cx) / rx, (cy - event.clientY) / ry);
    return topHour + (angle * 12) / Math.PI;
  };

  body.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    cancelAnimationFrame(glide);
    hour = readHour(hour);
    body.setPointerCapture(event.pointerId);
    body.classList.add("is-dragging");
    samples = [{ time: event.timeStamp, hour }];
  });

  body.addEventListener("pointermove", (event) => {
    if (!body.hasPointerCapture(event.pointerId)) return;

    const previous = samples.at(-1);
    const unwrapped = previous.hour + hourDelta(previous.hour, pointerHour(event));
    samples.push({ time: event.timeStamp, hour: unwrapped });
    samples = samples.filter((sample) => event.timeStamp - sample.time <= SAMPLE_MS);
    setHour(unwrapped);
  });

  body.addEventListener("pointerup", (event) => {
    body.classList.remove("is-dragging");
    const recent = samples.filter((sample) => event.timeStamp - sample.time <= SAMPLE_MS);
    if (reduceMotion.matches || recent.length < 2) return;

    const first = recent[0];
    const last = recent.at(-1);
    const speed = (last.hour - first.hour) / Math.max(last.time - first.time, 1);
    if (Math.abs(speed) > MIN_SPEED) {
      startGlide(Math.max(-MAX_SPEED, Math.min(MAX_SPEED, speed)));
    }
  });

  body.addEventListener("pointercancel", () => body.classList.remove("is-dragging"));
}
