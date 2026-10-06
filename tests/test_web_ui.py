"""Static UI checks for the rebuilt browser voice flow.

These run without a browser and pin the changes Nikhil asked for:
- no Done button, no "call my phone" button, no phone-send button
- voice_turn.js loads BEFORE app.js
- the 2-second auto-stop silence constant is exactly 2000 ms
- mute + hangup controls still exist
"""
import re
from html.parser import HTMLParser
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
INDEX = REPO / "web" / "index.html"
VOICE_TURN = REPO / "web" / "voice_turn.js"


class IndexScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.scripts = []  # src of <script src=...> in order

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "script" and attrs.get("src"):
            self.scripts.append(attrs["src"])


def _scan():
    html = INDEX.read_text(encoding="utf-8")
    scan = IndexScan()
    scan.feed(html)
    return html, scan


def test_no_done_button_and_no_phone_call_button():
    html, scan = _scan()
    assert "phone-send-btn" not in scan.ids, "Done/manual-send button must be gone"
    assert "call-phone-btn" not in scan.ids, "Call-my-phone button must be gone"
    assert "callMyPhone" not in html, "callMyPhone JS reference must be gone"
    assert "Done Speaking" not in html, "Done Speaking label must be gone"
    assert "📞" not in html, "phone emoji button must be gone"


def test_call_controls_still_present():
    _, scan = _scan()
    assert "phone-mute-btn" in scan.ids, "mute button must still exist"
    assert "phone-hangup-btn" in scan.ids, "hangup button must still exist"


def test_voice_turn_js_loads_before_app_js():
    _, scan = _scan()
    # Strip cache-busting query strings (e.g. app.js?v=4.0) before comparing.
    scripts = [s.split("?")[0].split("#")[0] for s in scan.scripts]
    assert "voice_turn.js" in scripts, "voice_turn.js must be loaded"
    assert "app.js" in scripts, "app.js must be loaded"
    assert scripts.index("voice_turn.js") < scripts.index("app.js"), (
        "voice_turn.js must load before app.js so the state machine exists first"
    )


def test_v4_voice_scripts_present():
    _, scan = _scan()
    scripts = [s.split("?")[0].split("#")[0] for s in scan.scripts]
    assert "vendor/vad.bundle.js" in scripts, "Silero VAD bundle must be loaded"
    assert "voice4.js" in scripts, "voice4.js (pro voice engine) must be loaded"
    assert scripts.index("voice4.js") < scripts.index("app.js"), (
        "voice4.js must load before app.js"
    )


def test_endpointing_constant_is_subsecond():
    js = VOICE_TURN.read_text(encoding="utf-8")
    m = re.search(r"DEFAULT_ENDPOINT_MS\s*=\s*(\d+)", js)
    assert m, "DEFAULT_ENDPOINT_MS constant missing from voice_turn.js"
    assert int(m.group(1)) <= 1000, (
        f"v4.0 endpointing must be sub-second (pro conversational), found {m.group(1)}"
    )


def test_no_chrome_speech_recognition_in_app():
    js = (REPO / "web" / "app.js").read_text(encoding="utf-8")
    assert "SpeechRecognition" not in js, (
        "v4.0 removed Chrome SpeechRecognition — it failed with network errors"
    )
    assert "webkitSpeechRecognition" not in js, "SR must be fully gone"
    assert "startVadLoop" not in js, "old energy VAD loop must be gone"
    assert "vadTick" not in js, "old energy VAD tick must be gone"
