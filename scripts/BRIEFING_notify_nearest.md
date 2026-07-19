# Briefing: Implementace `notify_nearest` service v integraci `ha-vernostni-karty`

## Kontext projektu

Jde o dvě propojené HA komponenty:

| Repozitář | Typ | Co dělá |
|---|---|---|
| `tomasbarton-com/ha-vernostni-karty` | HA integrace (Python) | backend, ukládá data, registruje services a WebSocket handlery |
| `tomasbarton-com/ha-vernostni-karty-card` | HACS Lovelace karta (JS) | frontend, zobrazuje karty, volá backend přes `callService` / `callWS` |

Ty máš přístup k **backendu (`ha-vernostni-karty`)** — tam je celá tato práce.

---

## Co chceme přidat

Novou HA **service** s názvem `loyalty_cards.notify_nearest`, která:

1. Zjistí GPS polohu přes `device_tracker` (stejná logika jako karta).
2. Zavolá `homeassistant.update_entity` → počká 2 s → načte čerstvé souřadnice.
3. Ze svých dat najde nejbližší obchod (Haversine vzdálenost).
4. Serverově **vygeneruje PNG obrázek čárového kódu** (bez externích API).
5. Uloží PNG do `/config/www/loyalty_barcode_<store_id>.png`.
6. Pošle push notifikaci na hodinky/telefon přes `notify.mobile_app_...` se správnou `image:` URL.

Výsledkem je, že uživatel přidá do HA automace jeden řádek:

```yaml
- action: loyalty_cards.notify_nearest
  data:
    notify_service: mobile_app_tomas_iphone
    max_distance: 1000
```

---

## Datové struktury (přesně tak jak jsou v backendu)

### `get_data` response — struktura `stores`

```python
{
  "stores": [
    {
      "id": "abc123",           # unikátní ID (string)
      "name": "Albert",
      "tile_color": "#e53935",
      "store_key": "albert",    # volitelné, klíč z katalogu
      "category": "grocery",    # volitelné
      "cards": [
        {
          "id": "card_xyz",
          "name": "Zákaznická karta",
          "barcode": "8594404123456",
          "barcode_type": "EAN_13",  # viz seznam níže
          "notes": ""
        }
        # může být víc karet
      ],
      "locations": [
        {
          "lat": 50.08804,
          "lon": 14.42076,
          "radius_m": 40,        # poloměr detekce, výchozí 40
          "label": "Dejvická"    # volitelné
        }
        # může být víc lokací
      ]
    }
  ],
  "settings": {
    "device_trackers": [],              # volitelné přepsání
    "global_proximity_m": 300,
    "notification_dwell_minutes": 7,
    "notifications_enabled": True
  }
}
```

### Typy čárových kódů (`barcode_type`)

Karta v JS definuje tyto typy:

```
EAN_13, EAN_8, UPC_A, UPC_E,
CODE_128, CODE_39, ITF,
QR_CODE, DATA_MATRIX, PDF_417, AZTEC
```

Mapping na Python knihovny (viz sekce Generování obrázků níže):

| barcode_type | python-barcode | poznámka |
|---|---|---|
| `EAN_13` | `ean13` | 12 číslic + 1 check digit automaticky |
| `EAN_8` | `ean8` | 7 číslic + check digit |
| `UPC_A` | `upca` | |
| `CODE_128` | `code128` | general purpose, nejčastější |
| `CODE_39` | `code39` | |
| `ITF` | `itf` | |
| `QR_CODE` | — | použij `qrcode` library |
| `DATA_MATRIX`, `PDF_417`, `AZTEC` | nepodporováno | fallback: generuj QR se stejnou hodnotou |

---

## Logika nalezení device_tracker (stejná jako v kartě)

```python
def find_gps_tracker(hass):
    """Vrátí entity_id nejčerstvějšího GPS device_tracker."""
    candidates = [
        state for state in hass.states.async_all("device_tracker")
        if state.attributes.get("source_type") == "gps"
        and state.attributes.get("latitude") is not None
        and state.attributes.get("longitude") is not None
    ]
    if not candidates:
        return None
    # Nejčerstvější záznam
    candidates.sort(key=lambda s: s.last_updated, reverse=True)

    # Pokus se najít tracker odpovídající přihlášenému uživateli
    # (logika z JS: porovnává jméno uživatele s entity_id)
    # → tuto část můžeš přeskočit, první/nejčerstvější je obvykle správný

    return candidates[0].entity_id
```

**Refresh sekvence (přesně jako v kartě):**

```python
async def refresh_and_get_location(hass, entity_id):
    """Vyvolá nativní update polohy a vrátí (lat, lon)."""
    await hass.services.async_call(
        "homeassistant", "update_entity",
        {"entity_id": entity_id},
        blocking=True
    )
    await asyncio.sleep(2)  # Companion App potřebuje čas na push

    state = hass.states.get(entity_id)
    lat = state.attributes.get("latitude")
    lon = state.attributes.get("longitude")
    if lat is None or lon is None:
        return None, None
    return float(lat), float(lon)
```

---

## Haversine vzdálenost

```python
import math

def geo_distance_m(lat1, lon1, lat2, lon2):
    R = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = (math.sin((p2 - p1) / 2) ** 2
         + math.cos(p1) * math.cos(p2)
         * math.sin(math.radians(lon2 - lon1) / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))

def find_nearest_store(stores, lat, lon):
    """Vrátí (store, dist_m) pro nejbližší obchod s min. jednou lokací."""
    best_store, best_dist = None, float("inf")
    for store in stores:
        locs = store.get("locations") or []
        if not locs:
            continue
        d = min(geo_distance_m(lat, lon, loc["lat"], loc["lon"]) for loc in locs)
        if d < best_dist:
            best_dist, best_store = d, store
    return best_store, best_dist
```

---

## Generování obrázku čárového kódu (serverově, bez externích API)

### Závislosti

Přidej do `requirements.txt` / `manifest.json`:
```
python-barcode[images]>=0.15.1
qrcode[pil]>=7.4.2
Pillow>=10.0.0
```

> `python-barcode[images]` zahrnuje Pillow writer. `qrcode[pil]` potřebuje PIL.

### Kód pro generování

```python
import io
import os

def generate_barcode_png(value: str, barcode_type: str, output_path: str) -> bool:
    """
    Vygeneruje PNG čárového kódu a uloží ho na output_path.
    Vrátí True při úspěchu, False při chybě.
    """
    btype = barcode_type.upper()

    # QR code
    if btype == "QR_CODE":
        try:
            import qrcode
            img = qrcode.make(value)
            img.save(output_path)
            return True
        except Exception:
            return False

    # Nepodporované 2D formáty → fallback na QR
    if btype in ("DATA_MATRIX", "PDF_417", "AZTEC"):
        try:
            import qrcode
            img = qrcode.make(value)
            img.save(output_path)
            return True
        except Exception:
            return False

    # 1D čárové kódy přes python-barcode
    BARCODE_MAP = {
        "EAN_13":  "ean13",
        "EAN_8":   "ean8",
        "UPC_A":   "upca",
        "UPC_E":   "upce",
        "CODE_128": "code128",
        "CODE_39":  "code39",
        "ITF":      "itf",
    }
    fmt = BARCODE_MAP.get(btype, "code128")

    try:
        import barcode
        from barcode.writer import ImageWriter

        writer = ImageWriter()
        # Nastavení pro čistý PNG bez textu pod kódem
        writer_options = {
            "module_height": 10.0,
            "font_size": 6,
            "text_distance": 2,
            "quiet_zone": 4,
            "dpi": 200,
        }
        buf = io.BytesIO()
        bc = barcode.get(fmt, value, writer=writer)
        bc.write(buf, options=writer_options)
        buf.seek(0)

        # Ulož do souboru
        with open(output_path, "wb") as f:
            f.write(buf.read())
        return True

    except Exception:
        return False
```

### Kam soubor uložit

```python
def get_barcode_path(hass, store_id: str) -> str:
    """Cesta pro uložení PNG. /config/www/ je přístupné jako /local/ v HA."""
    www_dir = hass.config.path("www")
    os.makedirs(www_dir, exist_ok=True)
    return os.path.join(www_dir, f"loyalty_barcode_{store_id}.png")

def get_barcode_url(hass, store_id: str) -> str:
    """URL pro notifikaci — HA External URL nebo fallback na local."""
    # Zkus external URL (funguje z mobilního telefonu venku)
    ext = hass.config.external_url
    base = ext.rstrip("/") if ext else (hass.config.internal_url or "http://homeassistant.local:8123").rstrip("/")
    return f"{base}/local/loyalty_barcode_{store_id}.png"
```

---

## Odeslání notifikace

```python
async def send_watch_notification(hass, notify_service: str, store: dict,
                                   dist_m: float, image_url: str | None):
    """
    notify_service: jméno BEZ prefixu 'notify.', např. 'mobile_app_tomas_iphone'
    """
    card = (store.get("cards") or [{}])[0]
    barcode_value = card.get("barcode", "")
    dist_str = f"{int(dist_m)} m" if dist_m < 1000 else f"{dist_m / 1000:.1f} km"

    notification_data = {
        "title": store["name"],
        "message": f"📍 {dist_str}  •  {barcode_value}",
        "data": {
            "tag": "loyalty_card_nearby",      # přepíše předchozí notifikaci (neustálý spam)
            "actions": [
                {
                    "action": "URI",
                    "title": "Otevřít karty",
                    "uri": "homeassistant://navigate/lovelace/default",
                }
            ],
        },
    }

    if image_url:
        notification_data["data"]["image"] = image_url

    await hass.services.async_call(
        "notify",
        notify_service,   # např. 'mobile_app_tomas_iphone'
        notification_data,
        blocking=False    # neblokuj — telefon může být offline
    )
```

---

## Registrace nové service v integraci

Najdi v kódu integrace místo, kde se registrují ostatní services (`add_store`, `add_card`, `add_location`, atd.). Bude to přibližně takto:

```python
# někde v async_setup_entry nebo setup_services():

hass.services.async_register(
    DOMAIN,            # "loyalty_cards"
    "add_store",
    handle_add_store,
    schema=ADD_STORE_SCHEMA,
)
# ... atd.
```

**Přidej vedle nich:**

```python
import voluptuous as vol
from homeassistant.helpers import config_validation as cv

NOTIFY_NEAREST_SCHEMA = vol.Schema({
    vol.Required("notify_service"): cv.string,        # např. "mobile_app_tomas_iphone"
    vol.Optional("max_distance", default=1000): vol.Coerce(int),
})

hass.services.async_register(
    DOMAIN,
    "notify_nearest",
    handle_notify_nearest,
    schema=NOTIFY_NEAREST_SCHEMA,
)
```

### Handler

```python
async def handle_notify_nearest(call: ServiceCall) -> None:
    """Service handler pro loyalty_cards.notify_nearest."""
    notify_service = call.data["notify_service"]
    max_distance   = call.data.get("max_distance", 1000)

    # 1. Získej data obchodů z koordinátoru / úložiště integrace
    #    (použij stejný způsob jako get_data WebSocket handler)
    stores = get_stores_from_storage(hass)  # ← uprav dle skutečného API integraci

    # 2. Najdi GPS tracker
    entity_id = find_gps_tracker(hass)
    if not entity_id:
        _LOGGER.warning("notify_nearest: no GPS device_tracker found")
        return

    # 3. Refresh polohy
    lat, lon = await refresh_and_get_location(hass, entity_id)
    if lat is None:
        _LOGGER.warning("notify_nearest: could not get location from %s", entity_id)
        return

    # 4. Nejbližší obchod
    store, dist_m = find_nearest_store(stores, lat, lon)
    if not store:
        _LOGGER.debug("notify_nearest: no store with location found")
        return

    if dist_m > max_distance:
        _LOGGER.debug("notify_nearest: nearest store %s is %.0f m away (limit %d m)",
                      store["name"], dist_m, max_distance)
        return

    # 5. Generuj obrázek
    card       = (store.get("cards") or [{}])[0]
    barcode    = card.get("barcode", "")
    bcode_type = card.get("barcode_type", "CODE_128")
    image_url  = None

    if barcode:
        path = get_barcode_path(hass, store["id"])
        ok   = await hass.async_add_executor_job(
            generate_barcode_png, barcode, bcode_type, path
        )
        if ok:
            image_url = get_barcode_url(hass, store["id"])

    # 6. Pošli notifikaci
    await send_watch_notification(hass, notify_service, store, dist_m, image_url)

    _LOGGER.info("notify_nearest: sent notification for %s (%.0f m)", store["name"], dist_m)
```

> **Pozor na `async_add_executor_job`**: `generate_barcode_png` blokuje I/O (zápis souboru) —
> musí jít přes executor, ne přímo v async handleru.

---

## Jak integrace přistupuje k datům

Neznám přesnou strukturu tohoto projektu, ale hledej v kódu **WebSocket handler** pro `loyalty_cards/get_data`:

```python
# Bude vypadat nějak takto:
@websocket_api.websocket_command({vol.Required("type"): "loyalty_cards/get_data"})
@websocket_api.async_response
async def websocket_get_data(hass, connection, msg):
    data = await store.async_load()   # nebo coordinator.data, nebo storage.async_load()
    connection.send_result(msg["id"], data)
```

Použij **přesně ten samý přístup k datům** v `handle_notify_nearest` — ber data ze stejného zdroje.

---

## Testování

### Ruční spuštění v HA Developer Tools → Services

```yaml
service: loyalty_cards.notify_nearest
data:
  notify_service: mobile_app_tomas_iphone
  max_distance: 2000
```

### Automace (finální podoba)

```yaml
alias: Věrnostní karta – nejbližší obchod
trigger: []        # volitelně: button press, NFC tag, zone enter...
sequence:
  - action: loyalty_cards.notify_nearest
    data:
      notify_service: mobile_app_tomas_iphone
      max_distance: 1000
  - delay: "00:01:00"
  - action: notify.mobile_app_tomas_iphone
    data:
      message: clear_notification
      data:
        tag: loyalty_card_nearby
```

---

## Checklist

- [ ] Přidat `python-barcode[images]`, `qrcode[pil]`, `Pillow` do `manifest.json` (pole `requirements`)
- [ ] Přidat funkce `find_gps_tracker`, `refresh_and_get_location`, `geo_distance_m`, `find_nearest_store`, `generate_barcode_png`, `get_barcode_path`, `get_barcode_url`, `send_watch_notification` — ideálně do nového souboru `notify_helpers.py`
- [ ] Přidat handler `handle_notify_nearest` do souboru s ostatními service handlery
- [ ] Zaregistrovat service `notify_nearest` se schématem (vedle ostatních services)
- [ ] Otestovat v Developer Tools
- [ ] Commitnout a vytvořit release

---

## Referenční Python skript (standalone varianta)

Viz `scripts/loyalty_card_notify.py` v repozitáři `ha-vernostni-karty-card` —
tamní skript dělá totéž přes REST/WebSocket API z příkazové řádky.
Obsahuje funkční Haversine, refresh polohy a odeslání notifikace.
Slouží jen jako reference; v integraci implementuj nativně (bez HTTP volání na sebe sama).
