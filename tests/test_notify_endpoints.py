# tests/test_notify_endpoints.py

import os
import requests
import pytest

# Base URL of your Netlify functions
BASE_URL = os.getenv(
    "NOTIFY_BASE_URL",
    "https://alumap-notification-bot.netlify.app/.netlify/functions"
)

# Default fixture data
EVENT_NAME = os.getenv("TEST_EVENT", "Тест")
OWNER_ALIAS = os.getenv("TEST_OWNER", "aladdinych")
USER_ALIAS  = os.getenv("TEST_USER",  "aladdinych")
TIMEOUT     = 5

@pytest.mark.parametrize("event, owner, user", [
    (EVENT_NAME, OWNER_ALIAS, USER_ALIAS),
])
def test_notify_join_ok(event, owner, user):
    """
    notifyJoin should return HTTP 200 and {"status":"ok"} when
    both aliases exist in the DB.
    """
    url = f"{BASE_URL}/notifyJoin/{event}/{owner}/{user}/"
    resp = requests.post(url, timeout=TIMEOUT)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data.get("status") == "ok"


@pytest.mark.parametrize("event, user", [
    (EVENT_NAME, USER_ALIAS),
])
def test_notify_upcoming_ok(event, user):
    """
    notifyUpcoming should return HTTP 200 and {"status":"ok"} when
    the user alias exists in the DB.
    """
    url = f"{BASE_URL}/notifyUpcoming/{event}/{user}/"
    resp = requests.post(url, timeout=TIMEOUT)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data.get("status") == "ok"


@pytest.mark.parametrize("endpoint,path,args,missing_alias", [
    ("notifyJoin", "/notifyJoin", ("BadEvent", "noone", "nobody"), ["noone","nobody"]),
    ("notifyUpcoming", "/notifyUpcoming", ("BadEvent","noone"), ["noone"]),
])
def test_alias_not_found(endpoint, path, args, missing_alias):
    """
    Tests that we get a 404 with a proper error payload
    when one or more aliases are not in the DB.
    """
    url = f"{BASE_URL}{path}/" + "/".join(args) + "/"
    resp = requests.post(url, timeout=TIMEOUT)
    assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
    data = resp.json()
    assert data.get("error") == "Alias not found"
    assert sorted(data.get("missing")) == sorted(missing_alias)
