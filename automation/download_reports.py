import asyncio
import os
import sys
import logging
import re
from datetime import datetime
from playwright.async_api import async_playwright
import config

def setup_logger(log_dir):
    os.makedirs(log_dir, exist_ok=True)
    date_str = datetime.now().strftime("%Y-%m-%d")
    log_file = os.path.join(log_dir, f"run_{date_str}.log")

    logger = logging.getLogger("VahanBot")
    logger.setLevel(logging.INFO)

    # Prevent duplicate handlers on repeat calls
    if logger.handlers:
        return logger

    # File handler
    fh = logging.FileHandler(log_file)
    fh.setLevel(logging.INFO)

    # Console handler
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)

    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    fh.setFormatter(formatter)
    ch.setFormatter(formatter)

    logger.addHandler(fh)
    logger.addHandler(ch)

    return logger

async def wait_for_overlay(page):
    try:
        await page.wait_for_selector(".ui-widget-overlay", state="hidden", timeout=5000)
        await asyncio.sleep(0.5)
    except:
        pass

async def goto_with_retries(page, url, logger, attempts=5):
    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            response = await page.goto(
                url,
                wait_until="domcontentloaded",
                timeout=config.TIMEOUTS["navigation"],
            )
            if response and not response.ok:
                raise RuntimeError(f"HTTP {response.status} while loading {url}")
            try:
                await page.wait_for_load_state(
                    "networkidle",
                    timeout=config.TIMEOUTS["network_idle_after_navigation"],
                )
            except Exception as idle_error:
                logger.warning(f"Continuing after network-idle wait failed: {str(idle_error)}")
            return
        except Exception as e:
            last_error = e
            if attempt == attempts:
                break
            logger.warning(f"Navigation attempt {attempt} failed: {str(e)}")
            await asyncio.sleep(min(20 * attempt, 60))
    raise last_error

async def safe_select(page, label_selector, item_selector, expected_value=None):
    """Click a primefaces dropdown label and select an item, then wait for networkidle."""
    await wait_for_overlay(page)

    # Check if already selected (if expected_value is provided)
    if expected_value:
        try:
            current_text = await page.locator(label_selector).inner_text(timeout=2000)
            if expected_value.strip() == current_text.strip():
                return
        except:
            pass

    await wait_for_overlay(page)
    # The Vahan site has overlapping layout grid elements, so force=True is required
    # But we wait for the AJAX overlay to be hidden first so PrimeFaces accepts the click
    await page.locator(label_selector).click(force=True)
    await asyncio.sleep(1) # Wait for dropdown animation
    await page.locator(item_selector).click(force=True)
    await page.wait_for_load_state("networkidle")
    await wait_for_overlay(page)
    await asyncio.sleep(1) # Extra buffer for JS execution

async def ensure_vehicle_filter_checked(page, label_text):
    """Tick a Vehicle Category/Class checkbox by its visible label, unless
    it's already checked. Changing Y-Axis/X-Axis re-renders this panel and
    clears it, so this must run after those selects, not before."""
    label = page.locator(config.SELECTORS["vehicle_filter_label"].format(label_text))
    checkbox_id = await label.get_attribute("for")
    if await page.locator(f'input[id="{checkbox_id}"]').is_checked():
        return
    await wait_for_overlay(page)
    await label.click(force=True)
    await page.wait_for_load_state("networkidle")
    await wait_for_overlay(page)
    await asyncio.sleep(1)

def extract_rto_code(rto):
    match = re.search(r"\bKL\s*0*(\d{1,2})\b", rto.upper())
    if match:
        return f"KL{int(match.group(1))}"
    return rto.replace(" ", "_")

def is_in_scope_rto(rto):
    match = re.search(r"\bKL\s*0*(\d{1,2})\b", rto.upper())
    return bool(match and 1 <= int(match.group(1)) <= config.EXPECTED_RTO_COUNT)


def validate_rto_list(rtos):
    codes = {extract_rto_code(rto) for rto in rtos}
    expected_codes = {f"KL{number}" for number in range(1, config.EXPECTED_RTO_COUNT + 1)}
    return len(rtos) == config.EXPECTED_RTO_COUNT and codes == expected_codes

async def process_rto(page, rto, output_dir, logger):
    logger.info(f"Processing {rto}...")

    # 1. Select RTO
    await safe_select(page, config.SELECTORS["rto_label"], config.SELECTORS["rto_item_specific"].format(rto))

    # 2. Click Refresh
    await wait_for_overlay(page)
    await page.locator(config.SELECTORS["refresh_btn"]).first.click(force=True)

    # 3. Wait for data to reload
    await page.wait_for_load_state("networkidle")
    await wait_for_overlay(page)
    await page.wait_for_selector(config.SELECTORS["table_row"], timeout=config.TIMEOUTS["table_load"])
    await asyncio.sleep(2) # Give PrimeFaces time to rebind Export button

    # 4. Click Export & capture download
    async with page.expect_download() as download_info:
        await page.locator(config.SELECTORS["export_btn"]).click(force=True)
    download = await download_info.value

    # 5. Save file
    rto_code = extract_rto_code(rto)

    filename = f"{rto_code}.xlsx"
    file_path = os.path.join(output_dir, filename)

    # Overwrite if exists
    if os.path.exists(file_path):
        os.remove(file_path)

    await download.save_as(file_path)
    logger.info(f"Successfully saved {filename}")
    return True

async def main():
    logger = setup_logger(config.LOGS_DIR)
    date_str = datetime.now().strftime("%Y-%m-%d")
    output_dir = os.path.join(config.REPORTS_DIR, date_str)
    os.makedirs(output_dir, exist_ok=True)

    logger.info(f"Starting Vahan report download for {date_str}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--disable-dev-shm-usage",
                "--no-sandbox",
            ],
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
            accept_downloads=True,
            timezone_id="Asia/Kolkata",
            locale="en-IN",
        )
        page = await context.new_page()
        page.set_default_timeout(config.TIMEOUTS["global_timeout"])

        try:
            logger.info("Navigating to target URL...")
            await goto_with_retries(page, config.TARGET_URL, logger)

            # Set Fixed Filters
            logger.info("Setting fixed filters...")
            await safe_select(page, config.SELECTORS["state_label"], config.SELECTORS["state_items"].format(config.FILTERS["State"]), config.FILTERS["State"])
            await safe_select(page, config.SELECTORS["yaxis_label"], config.SELECTORS["yaxis_item"].format(config.FILTERS["Y-Axis"]), config.FILTERS["Y-Axis"])
            await safe_select(page, config.SELECTORS["xaxis_label"], config.SELECTORS["xaxis_item"].format(config.FILTERS["X-Axis"]), config.FILTERS["X-Axis"])
            await safe_select(page, config.SELECTORS["yeartype_label"], config.SELECTORS["yeartype_item"].format(config.FILTERS["Year Type"]), config.FILTERS["Year Type"])
            await safe_select(page, config.SELECTORS["year_label"], config.SELECTORS["year_item"].format(config.FILTERS["Year"]), config.FILTERS["Year"])

            logger.info("Restricting to cars only (Vehicle Category=LMV, Vehicle Class=Motor Car)...")
            for label_text in config.VEHICLE_FILTER_LABELS:
                await ensure_vehicle_filter_checked(page, label_text)

            logger.info("Waiting for RTO list to populate...")
            await page.wait_for_function('document.querySelectorAll("ul#selectedRto_items li").length > 1')
            await asyncio.sleep(1)

            # Extract RTOs
            rto_elements = await page.locator(config.SELECTORS["rto_items"]).all()
            rtos = []
            for el in rto_elements:
                label = await el.get_attribute("data-label")
                if label and "All Vahan4 Running Office" not in label and is_in_scope_rto(label):
                    rtos.append(label)

            logger.info(f"Found {len(rtos)} RTOs to process.")

            if not validate_rto_list(rtos):
                logger.error(
                    f"Expected exactly {config.EXPECTED_RTO_COUNT} unique in-scope RTOs, "
                    f"but found {len(rtos)}. Aborting without publishing data."
                )
                sys.exit(1)

            failed_rtos = []

            # Process each RTO
            for i, rto in enumerate(rtos):
                try:
                    await process_rto(page, rto, output_dir, logger)
                except Exception as e:
                    logger.error(f"Failed to process {rto}: {str(e)}")
                    failed_rtos.append(rto)

                if i < len(rtos) - 1:
                    await asyncio.sleep(config.TIMEOUTS["between_iterations"])

            # Retry logic
            if failed_rtos:
                logger.info(f"Retrying {len(failed_rtos)} failed RTOs...")
                final_failed = []
                for rto in failed_rtos:
                    try:
                        await process_rto(page, rto, output_dir, logger)
                    except Exception as e:
                        logger.error(f"Retry failed for {rto}: {str(e)}")
                        final_failed.append(rto)

                if final_failed:
                    logger.error(f"Run failed after retries with {len(final_failed)} failures: {final_failed}")
                    sys.exit(1)
                else:
                    logger.info("Run completed successfully after retries.")
            else:
                logger.info("Run completed successfully with 0 failures.")

        except Exception as e:
            logger.error(f"Fatal error during execution: {str(e)}")
            sys.exit(1)
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
