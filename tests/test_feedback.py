#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# source ../venv/bin/activate && python3 test_feedback.py

# TIME ON SERVER IS MSK - 3 (UTC-0), SO ADD +3 when interpreting the feedback

import requests
import sys
import json
from datetime import datetime
from collections import defaultdict

# Default backend URL and timeout
BASE = "https://alumap-notification-bot.netlify.app/.netlify/functions"
TIMEOUT = 5

def get_feedback():
    """
    Fetch feedback data from the backend and return as JSON.
    """
    url = f"{BASE}/getFeedback"
    resp = requests.get(url, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def main():
    # Allow overriding the backend URL via command-line argument
    global BASE
    if len(sys.argv) == 2:
        BASE = sys.argv[1].rstrip("/")

    # Fetch data
    data = get_feedback()

    print("DATA:", json.dumps(data, indent=2, ensure_ascii=False))

    # Aggregate entries by date and alias
    grouped = defaultdict(lambda: defaultdict(list))
    for item in data:
        # Parse timestamp and strip 'Z'
        dt = datetime.fromisoformat(item['created_at'].rstrip('Z'))
        # Format date as 'D Month' (e.g., '14 July')
        date_str = dt.strftime('%-d %B')
        alias = item.get('alias', '')
        time_str = dt.strftime('%H:%M:%S')
        option = item['option_ids'][0] if item.get('option_ids') else ''
        poll = item.get('poll_id', '')
        grouped[date_str][alias].append((time_str, option, poll))

    # Prepare output filename with today's date (e.g., '15_Jul_Feedback.txt')
    today = datetime.now()
    filename = today.strftime('%d_%b_Feedback.txt')

    # Write aggregated feedback to file
    with open('../feedback/' + filename, 'w', encoding='utf-8') as f:
        for date in sorted(
            grouped.keys(),
            key=lambda d: datetime.strptime(d, '%d %B'),
            reverse=True
        ):
            f.write(f"{date}:\n")
            for alias, entries in grouped[date].items():
                f.write(f"  {alias}:\n")
                for time_str, option, poll in sorted(entries):
                    if option:
                        f.write(f"    {time_str} - {option} - {poll}\n")
                    else:
                        f.write(f"    {time_str} - nothing - {poll}\n")

    print(f"Feedback written to {filename}")


if __name__ == '__main__':
    main()
