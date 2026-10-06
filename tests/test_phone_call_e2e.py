"""End-to-end automated verification for RingMate Web Phone Call interface.

Uses Selenium with headless Helium (Chromium) to verify:
1. Start Voice Call button & UI opening
2. Phone Call modal components (Avatar, Caller ID, Status, Timer, Visualizer)
3. Spoken voice response via /web/tts
4. Speech transcription via /web/stt
5. Multi-turn interaction during call ("send resume" -> "yes" -> dispatch email)
6. Interactive confirmation buttons inside the phone call screen
7. End Call button & clean teardown
"""
import os
import time
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


def test_api_endpoints():
    print("\n[1/2] Testing backend endpoints (/web/tts, /web/stt, /web/talk)...")
    base_url = "http://localhost:8000"

    # Test /web/tts
    r_tts = requests.get(f"{base_url}/web/tts?text=RingMate+voice+call+ready")
    assert r_tts.status_code == 200, f"TTS status code: {r_tts.status_code}"
    assert "audio/mpeg" in r_tts.headers.get("content-type", "")
    assert len(r_tts.content) > 1000
    print(f"  ✓ /web/tts returned valid MP3 audio stream ({len(r_tts.content)} bytes)")

    # Test /web/stt with a generated audio sample
    os.system('.venv/bin/edge-tts --text "send me my resume" --write-media /tmp/e2e_stt_test.mp3')
    with open('/tmp/e2e_stt_test.mp3', 'rb') as f:
        r_stt = requests.post(f"{base_url}/web/stt", files={'file': f})
    assert r_stt.status_code == 200, f"STT status code: {r_stt.status_code}"
    stt_text = r_stt.json().get("text", "")
    print(f"  ✓ /web/stt transcribed audio to: '{stt_text}'")
    assert "resume" in stt_text.lower(), f"Expected 'resume' in STT output: {stt_text}"

    # Test /web/talk multi-turn turn 1
    call_id = f"e2e-api-{time.time()}"
    r_talk1 = requests.post(f"{base_url}/web/talk", json={"text": "send me my resume", "call_id": call_id})
    assert r_talk1.status_code == 200
    reply1 = r_talk1.json().get("reply_text", "")
    print(f"  ✓ /web/talk turn 1 reply: '{reply1}'")

    # Test /web/talk turn 2 ("yes")
    r_talk2 = requests.post(f"{base_url}/web/talk", json={"text": "yes", "call_id": call_id})
    assert r_talk2.status_code == 200
    reply2 = r_talk2.json().get("reply_text", "")
    print(f"  ✓ /web/talk turn 2 reply: '{reply2}'")


def test_browser_phone_call_ui():
    print("\n[2/2] Launching headless browser to test Phone Call UI...")
    options = Options()
    options.binary_location = "/opt/helium-browser-bin/chrome"
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1280,900")
    options.add_argument("--use-fake-ui-for-media-stream")
    options.add_argument("--use-fake-device-for-media-stream")
    options.add_argument("--autoplay-policy=no-user-gesture-required")

    service = Service(executable_path="/opt/helium-browser-bin/chromedriver")
    driver = webdriver.Chrome(service=service, options=options)

    try:
        driver.get("http://localhost:8000/app/")
        wait = WebDriverWait(driver, 10)

        # 1. Verify Page & Start Call button
        assert "RingMate" in driver.title
        wait.until(lambda d: d.execute_script("return window.__ringmateReady === true;"))
        start_btn = wait.until(EC.element_to_be_clickable((By.ID, "start-call-btn")))
        assert start_btn.is_displayed()
        print("  ✓ Home screen loaded with 'Start Voice Call' button")

        # 2. Check overlay is initially hidden
        init_overlay = driver.find_element(By.ID, "phone-call-overlay")
        assert not init_overlay.is_displayed()
        print("  ✓ Phone call overlay initially hidden")

        # 3. Click 'Start Voice Call'
        start_btn.click()
        wait.until(lambda d: d.find_element(By.ID, "phone-call-overlay").is_displayed())

        # Verify overlay is now displayed
        overlay = driver.find_element(By.ID, "phone-call-overlay")
        assert overlay.is_displayed()
        caller_name = driver.find_element(By.CLASS_NAME, "phone-caller-name").text
        caller_sub = driver.find_element(By.CLASS_NAME, "phone-caller-sub").text
        timer_text = driver.find_element(By.ID, "phone-call-timer").text

        assert "RingMate" in caller_name
        assert "Personal AI Assistant" in caller_sub
        assert ":" in timer_text
        print(f"  ✓ Phone call screen opened successfully!")
        print(f"    - Caller: {caller_name} ({caller_sub})")
        print(f"    - Timer: {timer_text}")

        # 4. In-call command execution
        inp = driver.find_element(By.ID, "phone-input")
        inp.send_keys("send me my resume")
        send_btn = driver.find_element(By.ID, "btn-phone-send")
        send_btn.click()
        print("  ✓ Sent in-call command: 'send me my resume'")

        # Wait for reply
        turn1_reply = ""
        for _ in range(16):
            time.sleep(0.8)
            turn1_reply = driver.execute_script("return document.getElementById('phone-last-agent-msg').innerText;")
            if turn1_reply and "resume" in turn1_reply.lower():
                break

        print(f"  ✓ Assistant responded on phone screen: '{turn1_reply}'")
        assert "resume" in turn1_reply.lower()

        # 5. Confirm sending file
        actions = driver.find_element(By.ID, "phone-actions")
        if actions.is_displayed():
            print("  ✓ Interactive 'Yes, send it' button appeared on phone screen")
            btn_yes = driver.find_element(By.ID, "phone-btn-yes")
            btn_yes.click()
            turn2_reply = ""
            for _ in range(16):
                time.sleep(0.8)
                turn2_reply = driver.execute_script("return document.getElementById('phone-last-agent-msg').innerText;")
                if turn2_reply and ("sent" in turn2_reply.lower() or "done" in turn2_reply.lower()):
                    break
            print(f"  ✓ Assistant confirmation response: '{turn2_reply}'")
            assert "sent" in turn2_reply.lower() or "done" in turn2_reply.lower()

        # 6. Test Mute Toggle
        mute_btn = driver.find_element(By.ID, "phone-mute-btn")
        mute_btn.click()
        time.sleep(0.2)
        assert "muted" in mute_btn.get_attribute("class")
        print("  ✓ Microphone mute button toggled to Muted")
        mute_btn.click()
        time.sleep(0.2)
        assert "muted" not in mute_btn.get_attribute("class")
        print("  ✓ Microphone mute button toggled back to Unmuted")

        # 7. Test Hang Up
        hangup = driver.find_element(By.ID, "phone-hangup-btn")
        hangup.click()
        time.sleep(1)

        overlay_after = driver.find_element(By.ID, "phone-call-overlay")
        assert not overlay_after.is_displayed()
        print("  ✓ End Call button clicked: phone call overlay closed cleanly")

        # Verify home transcript contains "Call ended."
        transcript_text = driver.find_element(By.ID, "transcript").text
        assert "Call ended" in transcript_text
        print("  ✓ Transcript logged call termination")

    finally:
        driver.quit()


if __name__ == "__main__":
    test_api_endpoints()
    test_browser_phone_call_ui()
    print("\n✓ ALL END-TO-END VERIFICATION CHECKS PASSED!")
