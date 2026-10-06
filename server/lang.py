"""Language strings for RingMate voice responses.

All hardcoded agent speech (fillers, tool replies, confirmations, errors)
goes through t() so the agent speaks the user's configured language.

Supported: en (English), te (Telugu), hi (Hindi), ta (Tamil).
Falls back to English for missing keys or unsupported languages.
"""
from __future__ import annotations

import os

_STRINGS: dict[str, dict[str, str]] = {
    "en": {
        # Fillers (spoken instantly while tools run).
        "filler_on_it": "On it.",
        "filler_one_moment": "One moment.",
        "filler_let_me_check": "Let me check.",
        "filler_searching": "Searching your laptop now.",
        "filler_checking_calendar": "Checking your calendar.",
        # Phone contextual fillers (v4.2.0): meaningful sentences naming the
        # actual work, so the caller hears progress instead of dead air.
        "phone_filler_weather": "Checking the weather in {place} for you.",
        "phone_filler_weather_generic": "Checking the weather for you.",
        "phone_filler_file": "Looking for {keywords} on your laptop.",
        "phone_filler_email": "Composing that email now.",
        "phone_filler_calendar": "Checking your calendar.",
        "phone_filler_lookup": "Looking that up for you.",
        "phone_filler_default": "Working on it.",
        # File flow.
        "found_file": "I found {name}, edited on {date}.",
        "is_this_the_file": "Is this the file?",
        "which_file": "Which file did you mean?",
        "file_sent": "Sent {name} to {to}.",
        "file_not_found": "I couldn't find '{query}'.",
        "wont_send": "Okay, I won't send it.",
        "wont_do": "Okay, I won't do that. Anything else?",
        "confirm_send": "Just to be sure — should I send {name}? Say yes or no.",
        # Email.
        "email_sent": "Email sent to {to}.",
        "email_failed": "I couldn't send the email: {error}",
        # Calendar.
        "no_events": "Nothing on your calendar for that day. Enjoy the free time.",
        "schedule_intro": "Here's your schedule: ",
        "event_scheduled": "Done — '{summary}' scheduled for {when}.",
        "event_cancelled": "Done — cancelled '{summary}'.",
        "event_moved": "Done — moved '{summary}' to {when}.",
        "confirm_cancel": "Found '{summary}' at {when}. Should I cancel it?",
        "which_event_cancel": "I found several: {names}. Which one should I cancel?",
        "which_event_move": "I found several: {names}. Which one should I move?",
        "event_not_found": "I couldn't find '{query}' on your calendar for {day}.",
        "calendar_not_connected": "Google Calendar isn't connected yet. Open /web/oauth/authorize in your browser to connect it.",
        # Drive.
        "drive_not_connected": "Google Drive isn't connected yet. Open /web/oauth/authorize in your browser to connect it.",
        "drive_not_found": "I couldn't find '{query}' on your Drive.",
        "drive_confirm_send": "Got it — '{name}'. Should I send it to your email? Say yes, or name an address.",
        "drive_which": "Which Drive file? Say 'the first one', or 'send that to me'.",
        # Notes / memory.
        "note_saved": "Noted — I'll remember that.",
        "no_notes": "You haven't asked me to remember anything yet.",
        "memory_saved": "Got it — I'll remember that.",
        "no_memory": "I don't have anything in my long-term memory yet. Tell me something about yourself and I'll remember it.",
        # Generic.
        "didnt_catch": "I didn't quite get that — could you say it differently?",
        "cant_do": "I can't do that yet.",
        "clarify": "Could you say that differently?",
        "anything_else": "Anything else?",
    },
    "te": {
        "filler_on_it": "చేస్తున్నాను.",
        "filler_one_moment": "ఒక్క నిమిషం.",
        "filler_let_me_check": "చూస్తున్నాను.",
        "filler_searching": "మీ ల్యాప్‌టాప్‌లో వెతుకుతున్నాను.",
        "filler_checking_calendar": "మీ క్యాలెండర్ చూస్తున్నాను.",
        "phone_filler_weather": "{place}లో వాతావరణం చూస్తున్నాను.",
        "phone_filler_weather_generic": "వాతావరణం చూస్తున్నాను.",
        "phone_filler_file": "మీ ల్యాప్‌టాప్‌లో {keywords} వెతుకుతున్నాను.",
        "phone_filler_email": "ఇప్పుడు ఈమెయిల్ రాస్తున్నాను.",
        "phone_filler_calendar": "మీ క్యాలెండర్ చూస్తున్నాను.",
        "phone_filler_lookup": "మీ కోసం వెతుకుతున్నాను.",
        "phone_filler_default": "చేస్తున్నాను.",
        "found_file": "{name} దొరికింది, {date} న సవరించబడింది.",
        "is_this_the_file": "ఇదేనా ఫైల్?",
        "which_file": "ఏ ఫైల్ అనుకున్నారు?",
        "file_sent": "{name} ను {to} కి పంపాను.",
        "file_not_found": "'{query}' దొరకలేదు.",
        "wont_send": "సరే, పంపను.",
        "wont_do": "సరే, చేయను. ఇంకేమైనా?",
        "confirm_send": "నిర్ధారణ కోసం — {name} పంపమంటారా? అవును లేదా కాదు అనండి.",
        "confirm_cancel": "'{summary}' {when} కి దొరికింది. రద్దు చేయమంటారా? అవును లేదా కాదు అనండి.",
        "confirm_send_email": "నిర్ధారణ కోసం — {name} పంపమంటారా?",
        "email_sent": "{to} కి ఈమెయిల్ పంపాను.",
        "email_failed": "ఈమెయిల్ పంపలేకపోయాను: {error}",
        "no_events": "ఆ రోజు మీ క్యాలెండర్‌లో ఏమీ లేదు.",
        "schedule_intro": "మీ షెడ్యూల్ ఇదిగో: ",
        "event_scheduled": "అయిపోయింది — '{summary}' {when} కి షెడ్యూల్ చేశాను.",
        "event_cancelled": "అయిపోయింది — '{summary}' రద్దు చేశాను.",
        "event_moved": "అయిపోయింది — '{summary}' ను {when} కి మార్చాను.",
        "which_event_cancel": "కొన్ని దొరికాయి: {names}. దేన్ని రద్దు చేయాలి?",
        "which_event_move": "కొన్ని దొరికాయి: {names}. దేన్ని మార్చాలి?",
        "event_not_found": "{day} న '{query}' మీ క్యాలెండర్‌లో దొరకలేదు.",
        "calendar_not_connected": "గూగుల్ క్యాలెండర్ ఇంకా కనెక్ట్ కాలేదు. కనెక్ట్ చేయడానికి బ్రౌజర్‌లో /web/oauth/authorize తెరవండి.",
        "drive_not_connected": "గూగుల్ డ్రైవ్ ఇంకా కనెక్ట్ కాలేదు. కనెక్ట్ చేయడానికి బ్రౌజర్‌లో /web/oauth/authorize తెరవండి.",
        "drive_not_found": "మీ డ్రైవ్‌లో '{query}' దొరకలేదు.",
        "drive_confirm_send": "దొరికింది — '{name}'. మీ ఈమెయిల్‌కి పంపమంటారా? అవును అనండి, లేదా అడ్రస్ చెప్పండి.",
        "drive_which": "ఏ డ్రైవ్ ఫైల్? 'మొదటిది' అనండి, లేదा 'నాకు పంపు' అనండి.",
        "note_saved": "నోట్ చేశాను — గుర్తుంచుకుంటాను.",
        "no_notes": "మీరు ఇంకా ఏమీ గుర్తుంచుకోమని అడగలేదు.",
        "memory_saved": "అర్థమైంది — గుర్తుంచుకుంటాను.",
        "no_memory": "నా దీర్ఘకాలిక జ్ఞాపకంలో ఇంకా ఏమీ లేదు. మీ గురించి ఏదైనా చెప్పండి, గుర్తుంచుకుంటాను.",
        "didnt_catch": "అర్థం కాలేదు — మళ్లీ చెప్పగలరా?",
        "cant_do": "అది నేను ఇంకా చేయలేను.",
        "clarify": "వేరేలా చెప్పగలరా?",
        "anything_else": "ఇంకేమైనా?",
    },
    "hi": {
        "filler_on_it": "कर रहा हूँ।",
        "filler_one_moment": "एक पल।",
        "filler_let_me_check": "देखता हूँ।",
        "filler_searching": "आपके लैपटॉप में खोज रहा हूँ।",
        "filler_checking_calendar": "आपका कैलेंडर देख रहा हूँ।",
        "phone_filler_weather": "{place} में मौसम देख रहा हूँ।",
        "phone_filler_weather_generic": "मौसम देख रहा हूँ।",
        "phone_filler_file": "आपके लैपटॉप में {keywords} खोज रहा हूँ।",
        "phone_filler_email": "अभी ईमेल लिख रहा हूँ।",
        "phone_filler_calendar": "आपका कैलेंडर देख रहा हूँ।",
        "phone_filler_lookup": "आपके लिए देख रहा हूँ।",
        "phone_filler_default": "कर रहा हूँ।",
        "found_file": "{name} मिल गई, {date} को संशोधित।",
        "is_this_the_file": "क्या यही फ़ाइल है?",
        "which_file": "आपका मतलब कौन सी फ़ाइल थी?",
        "file_sent": "{name} को {to} पर भेज दिया।",
        "file_not_found": "'{query}' नहीं मिली।",
        "wont_send": "ठीक है, नहीं भेजूँगा।",
        "wont_do": "ठीक है, नहीं करूँगी। और कुछ?",
        "confirm_send": "पक्का करने के लिए — क्या {name} भेज दूँ? हाँ या ना कहें।",
        "email_sent": "{to} को ईमेल भेज दिया।",
        "email_failed": "ईमेल नहीं भेज सका: {error}",
        "no_events": "उस दिन आपके कैलेंडर में कुछ नहीं है।",
        "schedule_intro": "आपका शेड्यूल: ",
        "event_scheduled": "हो गया — '{summary}' {when} के लिए शेड्यूल किया।",
        "event_cancelled": "हो गया — '{summary}' रद्द किया।",
        "event_moved": "हो गया — '{summary}' को {when} पर ले जाया गया।",
        "confirm_cancel": "'{summary}' {when} पर मिली। क्या रद्द कर दूँ?",
        "which_event_cancel": "कई मिलीं: {names}। कौन सी रद्द करूँ?",
        "which_event_move": "कई मिलीं: {names}। कौन सी हटाऊँ?",
        "event_not_found": "{day} को '{query}' आपके कैलेंडर में नहीं मिली।",
        "calendar_not_connected": "गूगल कैलेंडर अभी कनेक्ट नहीं है। कनेक्ट करने के लिए ब्राउज़र में /web/oauth/authorize खोलें।",
        "drive_not_connected": "गूगल ड्राइव अभी कनेक्ट नहीं है। कनेक्ट करने के लिए ब्राउज़र में /web/oauth/authorize खोलें।",
        "drive_not_found": "आपकी ड्राइव में '{query}' नहीं मिली।",
        "drive_confirm_send": "मिल गई — '{name}'। क्या आपके ईमेल पर भेज दूँ? हाँ कहें, या पता बताएँ।",
        "drive_which": "कौन सी ड्राइव फ़ाइल? 'पहली वाली' कहें, या 'मुझे भेज दो' कहें।",
        "note_saved": "नोट कर लिया — याद रखूँगा।",
        "no_notes": "आपने अभी कुछ याद रखने को नहीं कहा है।",
        "memory_saved": "समझ गया — याद रखूँगा।",
        "no_memory": "मेरी लंबी याददाश्त में अभी कुछ नहीं है। अपने बारे में कुछ बताएँ, याद रखूँगा।",
        "didnt_catch": "समझ नहीं आया — क्या फिर से कह सकते हैं?",
        "cant_do": "मैं वह अभी नहीं कर सकता।",
        "clarify": "क्या अलग तरह से कह सकते हैं?",
        "anything_else": "और कुछ?",
    },
}


def get_lang() -> str:
    """Current voice language from env (default 'en')."""
    return os.environ.get("VOICE_LANGUAGE", "en")


def t(key: str, **kwargs) -> str:
    """Translate a key to the current language, formatting with kwargs."""
    lang = get_lang()
    strings = _STRINGS.get(lang, _STRINGS["en"])
    template = strings.get(key, _STRINGS["en"].get(key, key))
    try:
        return template.format(**kwargs)
    except (KeyError, IndexError):
        return template
