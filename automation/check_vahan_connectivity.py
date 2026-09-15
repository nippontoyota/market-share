import argparse
import json
import sys
import time
from urllib import request
from urllib.error import URLError

import config


def check_url(url=config.TARGET_URL, attempts=2, timeout=15):
    errors = []
    for attempt in range(1, attempts + 1):
        try:
            req = request.Request(
                url,
                method="GET",
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
                    )
                },
            )
            with request.urlopen(req, timeout=timeout) as response:
                return {
                    "reachable": 200 <= response.status < 400,
                    "status": response.status,
                    "attempt": attempt,
                    "errors": errors,
                }
        except (TimeoutError, URLError, OSError) as exc:
            errors.append(f"attempt {attempt}: {exc}")
            if attempt < attempts:
                time.sleep(5)

    return {
        "reachable": False,
        "status": None,
        "attempt": attempts,
        "errors": errors,
    }


def main():
    parser = argparse.ArgumentParser(description="Check whether the Vahan portal is reachable.")
    parser.add_argument("--attempts", type=int, default=2)
    parser.add_argument("--timeout", type=int, default=15)
    args = parser.parse_args()

    result = check_url(attempts=args.attempts, timeout=args.timeout)
    print(json.dumps(result, indent=2))
    if not result["reachable"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
