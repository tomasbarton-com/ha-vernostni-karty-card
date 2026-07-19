#!/usr/bin/env python3
"""
loyalty_card_notify.py
Pošle notifikaci s nejbližším věrnostním obchodem a čárovým kódem.

Postup:
  1. Najde GPS device_tracker s nejčerstvější polohou.
  2. Zavolá homeassistant.update_entity → počká 2 s → načte čerstvé souřadnice.
  3. Přes WebSocket stáhne data z loyalty_cards/get_data.
  4. Najde nejbližší obchod (Haversine).
  5. Pošle notifikaci na hodinky s obrázkem čárového kódu.

Konfigurace (environment proměnné nebo přímá editace níže):
  HA_URL    – adresa HA, výchozí: http://homeassistant.local:8123
  HA_TOKEN  – long-lived access token (Profil → Dlouhodobé přístupové tokeny)
  HA_NOTIFY – jméno notify service BEZ prefixu "notify.", např. mobile_app_tomas_iphone
  MAX_DIST  – maximální vzdálenost v metrech, výchozí: 1000
"""

import asyncio
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

# ── Konfigurace ───────────────────────────────────────────────────────────────

HA_URL    = os.environ.get("HA_URL",    "http://homeassistant.local:8123").rstrip("/")
HA_TOKEN  = os.environ.get("HA_TOKEN",  "")
HA_NOTIFY = os.environ.get("HA_NOTIFY", "")   # např. mobile_app_tomas_iphone
MAX_DIST  = int(os.environ.get("MAX_DIST", "1000"))

# ── HTTP helpers (stdlib only) ────────────────────────────────────────────────

def _hdr():
    return {"Authorization": f"Bearer {HA_TOKEN}", "Content-Type": "application/json"}

def ha_get(path):
    req = urllib.request.Request(f"{HA_URL}{path}", headers=_hdr())
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

def ha_post(path, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(f"{HA_URL}{path}", data=data,
                                  headers=_hdr(), method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.status

# ── Geografie ─────────────────────────────────────────────────────────────────

def _dist_m(lat1, lon1, lat2, lon2):
    R = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = (math.sin((p2 - p1) / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))

# ── Device tracker ────────────────────────────────────────────────────────────

def find_tracker():
    states = ha_get("/api/states")
    gps = [
        s for s in states
        if s["entity_id"].startswith("device_tracker.")
        and s["attributes"].get("source_type") == "gps"
        and s["attributes"].get("latitude") is not None
    ]
    if not gps:
        raise SystemExit("Žádný GPS device_tracker nenalezen.")
    return sorted(gps, key=lambda s: s.get("last_updated", ""), reverse=True)[0]["entity_id"]

def refresh_location(entity_id):
    ha_post("/api/services/homeassistant/update_entity", {"entity_id": entity_id})
    time.sleep(2)
    s = ha_get(f"/api/states/{entity_id}")
    return float(s["attributes"]["latitude"]), float(s["attributes"]["longitude"])

# ── Loyalty data přes WebSocket ───────────────────────────────────────────────

async def _ws_get_data():
    try:
        import websockets
    except ImportError:
        raise SystemExit(
            "Chybí knihovna websockets.\n"
            "Nainstaluj: pip3 install websockets"
        )

    ws_url = (HA_URL
              .replace("http://", "ws://")
              .replace("https://", "wss://")) + "/api/websocket"

    async with websockets.connect(ws_url, open_timeout=10) as ws:
        msg = json.loads(await ws.recv())
        assert msg["type"] == "auth_required", f"Neočekávaná zpráva: {msg}"

        await ws.send(json.dumps({"type": "auth", "access_token": HA_TOKEN}))
        msg = json.loads(await ws.recv())
        if msg["type"] != "auth_ok":
            raise SystemExit(f"Autentizace selhala: {msg}")

        await ws.send(json.dumps({"id": 1, "type": "loyalty_cards/get_data"}))
        msg = json.loads(await ws.recv())

    if not msg.get("success"):
        raise SystemExit(f"loyalty_cards/get_data selhalo: {msg}")
    return msg["result"]

def get_loyalty_data():
    return asyncio.run(_ws_get_data())

# ── Nejbližší obchod ──────────────────────────────────────────────────────────

def find_nearest(stores, lat, lon):
    best_store, best_dist = None, float("inf")
    for store in stores:
        locs = store.get("locations") or []
        if not locs:
            continue
        d = min(_dist_m(lat, lon, loc["lat"], loc["lon"]) for loc in locs)
        if d < best_dist:
            best_dist, best_store = d, store
    return best_store, best_dist

# ── Obrázek čárového kódu ─────────────────────────────────────────────────────

_BARCODEAPI = {
    "EAN_13": "ean13", "EAN_8": "ean8",
    "UPC_A":  "upc",   "UPC_E": "upce",
    "CODE_128": "128", "CODE_39": "39",
    "ITF": "itf",
}

def barcode_image_url(value, btype):
    enc = urllib.parse.quote(str(value), safe="")
    if btype == "QR_CODE":
        return f"https://api.qrserver.com/v1/create-qr-code/?data={enc}&size=300x300"
    fmt = _BARCODEAPI.get(btype, "auto")
    return f"https://barcodeapi.org/api/{fmt}/{enc}"

# ── Notifikace ────────────────────────────────────────────────────────────────

def send_notify(store, dist_m):
    if not HA_NOTIFY:
        raise SystemExit(
            "Nastav HA_NOTIFY (jméno notify service, např. mobile_app_tomas_iphone)."
        )

    cards = store.get("cards") or []
    if not cards:
        print(f"Obchod '{store['name']}' nemá žádnou kartu, notifikace přeskočena.")
        return

    card     = cards[0]
    barcode  = card.get("barcode", "")
    btype    = card.get("barcode_type", "CODE_128")
    dist_str = f"{int(dist_m)} m" if dist_m < 1000 else f"{dist_m / 1000:.1f} km"

    payload = {
        "title": store["name"],
        "message": f"📍 {dist_str}  •  {barcode}",
        "data": {
            "image": barcode_image_url(barcode, btype),
            "tag":   "loyalty_card_nearby",
            "actions": [
                {
                    "action": "URI",
                    "title":  "Otevřít karty",
                    "uri":    "homeassistant://navigate/lovelace/default",
                }
            ],
        },
    }

    status = ha_post(f"/api/services/notify/{HA_NOTIFY}", payload)
    if status == 200:
        print(f"OK: {store['name']} ({dist_str}), kód {barcode}")
    else:
        print(f"Chyba notify HTTP {status}", file=sys.stderr)
        sys.exit(1)

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not HA_TOKEN:
        raise SystemExit(
            "Nastav HA_TOKEN.\n"
            "Vytvoř ho v HA: Profil → Dlouhodobé přístupové tokeny."
        )

    print("1/4  Hledám GPS tracker…")
    entity_id = find_tracker()
    print(f"     → {entity_id}")

    print("2/4  Aktualizuji polohu…")
    lat, lon = refresh_location(entity_id)
    print(f"     → {lat:.5f}, {lon:.5f}")

    print("3/4  Načítám věrnostní karty…")
    data   = get_loyalty_data()
    stores = data.get("stores") or []
    print(f"     → {len(stores)} obchodů")

    print("4/4  Hledám nejbližší obchod…")
    store, dist = find_nearest(stores, lat, lon)

    if not store:
        print("Žádné obchody s uloženou polohou, konec.")
        return

    dist_str = f"{int(dist)} m" if dist < 1000 else f"{dist / 1000:.1f} km"
    print(f"     → {store['name']} ({dist_str})")

    if dist > MAX_DIST:
        print(f"Nejbližší je {dist_str}, nad limitem {MAX_DIST} m — notifikace neodeslána.")
        return

    send_notify(store, dist)


if __name__ == "__main__":
    main()
