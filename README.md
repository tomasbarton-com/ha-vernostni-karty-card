# Věrnostní karty – Lovelace karta

Lovelace karta pro Home Assistant zobrazující věrnostní karty (čárové kódy, QR kódy) uložené v integraci [Věrnostní karty](https://github.com/tomasbarton-com/ha-vernostni-karty).

## Požadavky

Před instalací karty musí být nainstalována integrace **Věrnostní karty**:
👉 [https://github.com/tomasbarton-com/ha-vernostni-karty](https://github.com/tomasbarton-com/ha-vernostni-karty)

Karta komunikuje s integrací přes Home Assistant WebSocket API (`loyalty_cards/get_data`) a HA services (`loyalty_cards.*`).

---

## Instalace přes HACS

1. Otevři **HACS** v Home Assistantu.
2. Klikni na tři tečky (⋮) vpravo nahoře a vyber **Vlastní repozitáře**.
3. Přidej URL tohoto repozitáře:
   ```
   https://github.com/tomasbarton-com/ha-vernostni-karty-card
   ```
   a jako **Typ** vyber `Lovelace`.
4. Klikni **Přidat**, pak najdi kartu **Věrnostní karty – karta** a nainstaluj ji.
5. Restartuj Home Assistant nebo proveď **Vymazat mezipaměť** v prohlížeči.

---

## Přidání do dashboardu

V editoru dashboardu přidej kartu ručně (YAML):

```yaml
type: custom:loyalty-cards-card
```

---

## Hlavní repozitář (integrace)

[https://github.com/tomasbarton-com/ha-vernostni-karty](https://github.com/tomasbarton-com/ha-vernostni-karty)
