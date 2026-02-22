"""
Medical vision agent — click the on-screen button to capture & analyze.

Controls:
  Click "Capture & Analyze"  — freeze frame and run clinical analysis
  Click "New Capture"        — return to live view after seeing results
  Q                          — quit
"""

import base64
import sys
import threading
import time

import cv2
import numpy as np
import ollama


# ---------------------------------------------------------------------------
# Suppress macOS AVFoundation / Continuity Camera log spam
# ---------------------------------------------------------------------------
class _StderrFilter:
    _SKIP = ("AVCaptureDeviceTypeExternal", "ContinuityCamera",
             "NSCameraUseContinuityCameraDeviceType", "Info.plist")
    def __init__(self, orig): self._orig = orig
    def write(self, s):
        if s and any(k in s for k in self._SKIP): return
        self._orig.write(s)
    def flush(self): self._orig.flush()


PROMPT = """You are a clinician describing what you see in this image from a medical perspective.
Describe concisely (3-6 short sentences):
1. What body part or region is visible (face, arm, skin, wound, etc.).
2. Visible features: skin color/tone, redness (erythema), swelling, lesions, rashes, bruising, asymmetry.
3. Any signs needing attention: discoloration, dryness, texture changes, visible injury, or abnormality.
4. Overall impression: normal vs. anything warranting further evaluation.
Be factual and observational. If the image is unclear or non-medical, say so briefly. No bullet points."""


# ---------------------------------------------------------------------------
# Simple clickable button
# ---------------------------------------------------------------------------
class Button:
    def __init__(self, label, w=220, h=46,
                 color=(40,130,40), hover=(60,180,60)):
        self.label = label
        self.w, self.h = w, h
        self.color, self.hover_color = color, hover
        self.x = self.y = 0       # set each frame

    def place(self, cx, cy):
        """Center the button at (cx, cy)."""
        self.x = cx - self.w // 2
        self.y = cy - self.h // 2

    def hit(self, mx, my):
        return self.x <= mx <= self.x + self.w and self.y <= my <= self.y + self.h

    def draw(self, img, mx, my):
        col = self.hover_color if self.hit(mx, my) else self.color
        # Shadow
        cv2.rectangle(img, (self.x+3, self.y+3),
                      (self.x+self.w+3, self.y+self.h+3), (0,0,0), -1)
        # Body
        cv2.rectangle(img, (self.x, self.y),
                      (self.x+self.w, self.y+self.h), col, -1)
        # Border
        cv2.rectangle(img, (self.x, self.y),
                      (self.x+self.w, self.y+self.h), (255,255,255), 1)
        # Label
        font = cv2.FONT_HERSHEY_SIMPLEX
        (tw, th), _ = cv2.getTextSize(self.label, font, 0.6, 1)
        cv2.putText(img, self.label,
                    (self.x + (self.w-tw)//2, self.y + (self.h+th)//2),
                    font, 0.6, (255,255,255), 1, cv2.LINE_AA)


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------
def wrap_text(text, font, scale, thick, max_px):
    lines = []
    for sentence in text.replace("\n", " ").split(". "):
        sentence = sentence.strip()
        if not sentence: continue
        current = ""
        for word in sentence.split():
            cand = (current + " " + word).strip() if current else word
            (tw, _), _ = cv2.getTextSize(cand, font, scale, thick)
            if tw > max_px:
                if current: lines.append(current)
                current = word
            else:
                current = cand
        if current: lines.append(current)
    return lines


def draw_results_panel(base, lines, badge, badge_color, redness):
    """Overlay a semi-transparent bottom panel with analysis text."""
    out = base.copy()
    h, w = out.shape[:2]
    font, fs, tk = cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1
    lh, mg = 26, 14
    n         = min(len(lines), 14)
    panel_h   = mg + lh + n * lh + mg + 60   # 60 px reserved for button
    panel_top = h - panel_h
    ov = out.copy()
    cv2.rectangle(ov, (0, panel_top), (w, h), (15, 15, 25), -1)
    out = cv2.addWeighted(ov, 0.85, out, 0.15, 0)
    # Badge
    cv2.putText(out, badge, (13,35), font, 0.68, (0,0,0), 3)
    cv2.putText(out, badge, (12,34), font, 0.68, badge_color, 2)
    cv2.putText(out, f"Redness index: {redness}%",
                (12,60), font, 0.48, (150,150,150), 1)
    # Text
    y = panel_top + mg
    for line in lines[:14]:
        y += lh
        cv2.putText(out, line, (21, y+1), font, fs, (0,0,0), tk+1)
        cv2.putText(out, line, (20, y),   font, fs, (255,255,255), tk)
    return out, panel_top


def compute_redness(frame):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    m1  = cv2.inRange(hsv, np.array([0,50,50]),   np.array([10,255,255]))
    m2  = cv2.inRange(hsv, np.array([170,50,50]), np.array([180,255,255]))
    mask = cv2.bitwise_or(m1, m2)
    return round(np.count_nonzero(mask) / mask.size * 100, 1) if mask.size else 0.0


def open_camera():
    import platform
    backends = ([cv2.CAP_AVFOUNDATION, cv2.CAP_ANY]
                if platform.system() == "Darwin" else [cv2.CAP_ANY])
    orig = sys.stderr
    sys.stderr = _StderrFilter(orig)
    try:
        for idx in (0, 1, 2):
            for backend in backends:
                cap = cv2.VideoCapture(idx, backend)
                if not cap.isOpened(): continue
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
                for attempt in range(60):
                    time.sleep(0.05)
                    ok, f = cap.read()
                    if ok and f is not None and float(np.mean(f)) > 5.0:
                        print(f"Camera ready (index={idx}, attempt={attempt+1}, "
                              f"brightness={np.mean(f):.1f})", file=orig, flush=True)
                        return cap
                print(f"index={idx} backend={backend}: black frames, skipping.", file=orig)
                cap.release()
    finally:
        sys.stderr = orig
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    for _ in range(30): cap.read(); time.sleep(0.05)
    return cap


def run_analysis(frame, model, holder, lock):
    print("[analysis] Sending to Ollama...", flush=True)
    t0 = time.monotonic()
    try:
        h, w  = frame.shape[:2]
        scale = min(1.0, 512 / max(h, w))
        if scale < 1.0:
            frame = cv2.resize(frame, (int(w*scale), int(h*scale)),
                               interpolation=cv2.INTER_AREA)
        _, buf  = cv2.imencode(".jpg", frame)
        img_b64 = base64.b64encode(buf).decode()
        resp = ollama.chat(
            model=model,
            messages=[{"role":"user","content":PROMPT,"images":[img_b64]}],
        )
        text = (resp.message.content or "No response.").strip()
        print(f"[analysis] Done in {time.monotonic()-t0:.1f}s", flush=True)
    except Exception as e:
        text = f"Analysis error: {e}"
        print(f"[analysis] ERROR: {e}", flush=True)
    with lock:
        holder["text"]       = text
        holder["processing"] = False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def run(model_name="llama3.2-vision"):
    cap = open_camera()
    if not cap.isOpened():
        print("Could not open camera. Check System Settings > Privacy > Camera.")
        return

    WIN = "Medical Vision"
    cv2.namedWindow(WIN, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(WIN, 1280, 720)

    font = cv2.FONT_HERSHEY_SIMPLEX

    btn_capture = Button("Capture & Analyze", w=220, h=46,
                         color=(40,130,40), hover=(60,180,60))
    btn_new     = Button("New Capture",       w=180, h=46,
                         color=(30,100,180), hover=(50,140,220))

    lock   = threading.Lock()
    holder = {"text": "", "processing": False}

    captured    = None
    redness_pct = 0.0
    mode        = "live"          # live | analyzing | done

    mouse = {"x": 0, "y": 0, "clicked": False}

    def on_mouse(event, x, y, flags, _):
        mouse["x"], mouse["y"] = x, y
        if event == cv2.EVENT_LBUTTONDOWN:
            mouse["clicked"] = True

    cv2.setMouseCallback(WIN, on_mouse)
    print("Click 'Capture & Analyze' to take a picture. Press Q to quit.", flush=True)

    while True:
        ok, live = cap.read()
        if not ok or live is None:
            break

        h, w   = live.shape[:2]
        mx, my = mouse["x"], mouse["y"]
        clicked = mouse["clicked"]
        mouse["clicked"] = False   # consume click

        # Check if analysis finished
        if mode == "analyzing":
            with lock:
                if not holder["processing"]:
                    mode = "done"

        # Position buttons bottom-center
        btn_capture.place(w // 2, h - 36)
        btn_new.place(w // 2, h - 36)

        # Handle clicks
        if clicked:
            if mode == "live" and btn_capture.hit(mx, my):
                with lock:
                    busy = holder["processing"]
                if not busy:
                    captured    = live.copy()
                    redness_pct = compute_redness(captured)
                    mode        = "analyzing"
                    with lock:
                        holder["text"]       = ""
                        holder["processing"] = True
                    threading.Thread(
                        target=run_analysis,
                        args=(captured.copy(), model_name, holder, lock),
                        daemon=True,
                    ).start()

            elif mode == "done" and btn_new.hit(mx, my):
                mode = "live"

        # ---- Compose display ----
        if mode == "live":
            display = live.copy()
            # Subtle dark strip at bottom for button
            ov = display.copy()
            cv2.rectangle(ov, (0, h-80), (w, h), (20,20,30), -1)
            display = cv2.addWeighted(ov, 0.6, display, 0.4, 0)
            btn_capture.draw(display, mx, my)

        elif mode == "analyzing":
            with lock:
                desc = holder["text"] or "Analyzing... (~10-20s, please wait)"
            lines = wrap_text(desc, font, 0.55, 1, w - 40)
            display, _ = draw_results_panel(
                captured, lines, "Analyzing...", (0, 165, 255), redness_pct)

        else:  # done
            with lock:
                desc = holder["text"]
            lines = wrap_text(desc, font, 0.55, 1, w - 40)
            display, _ = draw_results_panel(
                captured, lines, "Analysis complete", (0, 220, 80), redness_pct)
            btn_new.draw(display, mx, my)

        cv2.imshow(WIN, display)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    run(model_name="llama3.2-vision")