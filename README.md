# homebridge-zockzeit

[![npm version](https://badge.fury.io/js/homebridge-zockzeit.svg)](https://badge.fury.io/js/homebridge-zockzeit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Ein Homebridge-Plugin, das eine Timer-Steuerung für Gaming-Zeit über HTTP-URLs als HomeKit Thermostat bereitstellt. Perfekt für Eltern, die die Gaming-Zeit ihrer Kinder überwachen und kontrollieren möchten.

## Features

✅ **Timer-Kontrolle**: Aktuelle und Ziel-Gaming-Zeit über HomeKit steuern  
✅ **HTTP-Integration**: Kommunikation über einfache HTTP-Anfragen  
✅ **Thermostat-Interface**: Intuitive Bedienung über die Home-App  
✅ **Automatische Überwachung**: Konfigurierbare Polling-Intervalle  
✅ **Reset-Funktion**: Separater Switch zum Zurücksetzen des Timers  
✅ **Robuste Fehlerbehandlung**: Graceful Degradation bei Verbindungsproblemen  
✅ **Keine externen Abhängigkeiten**: Verwendet nur Node.js Built-ins  

## Installation

### Über Homebridge UI (empfohlen)
1. Öffne die Homebridge UI
2. Gehe zu "Plugins" 
3. Suche nach "homebridge-zockzeit"
4. Klicke "Install"

### Über npm
```bash
npm install -g homebridge-zockzeit
```

### Manuell
```bash
git clone https://github.com/yourusername/homebridge-zockzeit.git
cd homebridge-zockzeit
npm install -g .
```

## Konfiguration

### Basis-Konfiguration

Füge folgende Konfiguration zu deiner Homebridge `config.json` hinzu:

```json
{
    "accessories": [
        {
            "accessory": "ZockZeit",
            "name": "Gaming Timer",
            "elapsedTimeURL": "http://192.168.1.55/elapsed",
            "targetTimeURL": "http://192.168.1.55/target",
            "setTargetTimeURL": "http://192.168.1.55/settarget?value=",
            "turnOnURLs": [
                "http://192.168.1.55/on"
            ],
            "turnOffURLs": [
                "http://192.168.1.55/off"
            ]
        }
    ]
}
```

### Erweiterte Konfiguration

```json
{
    "accessory": "ZockZeit",
    "name": "Gaming Timer",
    "elapsedTimeURL": "http://192.168.1.55/elapsed",
    "targetTimeURL": "http://192.168.1.55/target",
    "setTargetTimeURL": "http://192.168.1.55/settarget?value=",
    "turnOnURLs": [
        "http://192.168.1.55/on",
        "http://192.168.1.56/enable"
    ],
    "turnOffURLs": [
        "http://192.168.1.55/off",
        "http://192.168.1.56/disable"
    ],
    "resetURL": "http://192.168.1.55/reset",
    "elapsedPollInterval": 5,
    "targetPollInterval": 30,
    "requestTimeout": 5000,
    "minTemp": 0,
    "maxTemp": 480
}
```

## Konfigurationsparameter

| Parameter | Typ | Standard | Beschreibung |
|-----------|-----|----------|--------------|
| `accessory` | string | **erforderlich** | Muss "ZockZeit" sein |
| `name` | string | "ZockZeit" | Name des Accessories in HomeKit |
| `elapsedTimeURL` | string | optional | URL zum Abrufen der verstrichenen Zeit (in Minuten) |
| `targetTimeURL` | string | optional | URL zum Abrufen der Zielzeit (in Minuten) |
| `setTargetTimeURL` | string | optional | URL zum Setzen der Zielzeit (Wert wird angehängt) |
| `turnOnURLs` | array | `[]` | Liste von URLs, die beim Einschalten aufgerufen werden |
| `turnOffURLs` | array | `[]` | Liste von URLs, die beim Ausschalten aufgerufen werden |
| `resetURL` | string | optional | URL zum Zurücksetzen des Timers |
| `elapsedPollInterval` | number | `5` | Abfrageintervall für verstrichene Zeit (1-300 Sekunden) |
| `targetPollInterval` | number | `30` | Abfrageintervall für Zielzeit (5-3600 Sekunden) |
| `requestTimeout` | number | `5000` | HTTP-Request Timeout in Millisekunden (1000-30000) |
| `minTemp` | number | `0` | Minimale Zeit in Minuten |
| `maxTemp` | number | `1440` | Maximale Zeit in Minuten (24h) |

**Hinweis**: Mindestens eine der URLs `elapsedTimeURL` oder `targetTimeURL` muss konfiguriert werden.

## HTTP-API Anforderungen

### Server-Antworten

**Elapsed Time Endpoint** (`elapsedTimeURL`)
- **Anfrage**: `GET http://your-device/elapsed`
- **Antwort**: Numerischer Wert (verstrichene Minuten)
- **Beispiel**: `45`

**Target Time Endpoint** (`targetTimeURL`) 
- **Anfrage**: `GET http://your-device/target`
- **Antwort**: Numerischer Wert (Ziel-Minuten)
- **Beispiel**: `120`

**Set Target Time Endpoint** (`setTargetTimeURL`)
- **Anfrage**: `GET http://your-device/settarget?value=120`
- **Antwort**: Beliebig (wird ignoriert)

**Control Endpoints** (`turnOnURLs`, `turnOffURLs`, `resetURL`)
- **Anfrage**: `GET http://your-device/[on|off|reset]`
- **Antwort**: Beliebig (wird ignoriert)

### Beispiel-Server (Arduino/ESP32)

```cpp
#include <WiFi.h>
#include <WebServer.h>

WebServer server(80);
int elapsedMinutes = 0;
int targetMinutes = 120;
bool timerRunning = false;

void setup() {
    // WiFi Setup...
    
    server.on("/elapsed", []() {
        server.send(200, "text/plain", String(elapsedMinutes));
    });
    
    server.on("/target", []() {
        server.send(200, "text/plain", String(targetMinutes));
    });
    
    server.on("/settarget", []() {
        if (server.hasArg("value")) {
            targetMinutes = server.arg("value").toInt();
        }
        server.send(200, "text/plain", "OK");
    });
    
    server.on("/on", []() {
        timerRunning = true;
        server.send(200, "text/plain", "Timer started");
    });
    
    server.on("/off", []() {
        timerRunning = false;
        server.send(200, "text/plain", "Timer stopped");
    });
    
    server.on("/reset", []() {
        elapsedMinutes = 0;
        timerRunning = false;
        server.send(200, "text/plain", "Timer reset");
    });
    
    server.begin();
}

void loop() {
    server.handleClient();
    // Timer logic here...
}
```

## HomeKit Verwendung

### In der Home App

1. **Timer starten/stoppen**: Thermostat auf "Heizen" bzw. "Aus" stellen
2. **Zielzeit setzen**: Zieltemperatur ändern (1 Grad = 1 Minute)
3. **Aktuelle Zeit**: Wird als aktuelle Temperatur angezeigt
4. **Reset**: Separater Switch "Gaming Timer Reset" (falls konfiguriert)

### Interpretation

- **🌡️ Aktuelle Temperatur** = Verstrichene Gaming-Zeit in Minuten
- **🎯 Zieltemperatur** = Erlaubte Gaming-Zeit in Minuten  
- **🔥 Heizen** = Timer läuft / Gaming erlaubt
- **❄️ Aus** = Timer gestoppt / Gaming blockiert
- **🔄 Reset Switch** = Timer auf 0 zurücksetzen

### Siri-Befehle

```
"Setze Gaming Timer auf 60 Grad"        -> 60 Minuten Zielzeit
"Schalte Gaming Timer ein"               -> Timer starten
"Schalte Gaming Timer aus"               -> Timer stoppen
"Wie ist die Gaming Timer Temperatur?"   -> Aktuelle verstrichene Zeit
```

## Troubleshooting

### Plugin lädt nicht

**Fehler**: `Cannot find module 'axios'`
```bash
# Im Plugin-Verzeichnis:
npm install
```

**Fehler**: `At least one of elapsedTimeURL or targetTimeURL must be configured`
- Mindestens eine URL muss in der Konfiguration vorhanden sein

### HTTP-Verbindungsprobleme

**Timeouts**: 
- `requestTimeout` in Konfiguration erhöhen
- Netzwerkverbindung zum Gerät prüfen

**Falsche Werte**:
- Server-Antworten prüfen (müssen numerisch sein)
- HTTP-Status-Codes prüfen (sollten 200 sein)

### Logs aktivieren

In der Homebridge-Konfiguration:
```json
{
    "bridge": {
        "name": "Homebridge",
        "username": "CC:22:3D:E3:CE:30",
        "port": 51826,
        "pin": "031-45-154"
    },
    "accessories": [...],
    "platforms": [...],
    "disabledPlugins": [],
    "logLevel": "debug"
}
```

### Häufige Probleme

1. **Timer springt zurück**: Überprüfe `elapsedPollInterval` - evtl. zu frequent
2. **Thermostat reagiert nicht**: URLs in Browser testen
3. **Reset funktioniert nicht**: `resetURL` konfigurieren und Switch verwenden
4. **Werte außerhalb des Bereichs**: `minTemp`/`maxTemp` anpassen

## Beispiel-Setups

### Raspberry Pi mit Python

```python
from flask import Flask, request
import time

app = Flask(__name__)
start_time = 0
target_minutes = 120
timer_running = False

@app.route('/elapsed')
def elapsed():
    if timer_running and start_time > 0:
        return str(int((time.time() - start_time) / 60))
    return "0"

@app.route('/target')
def target():
    return str(target_minutes)

@app.route('/settarget')
def set_target():
    global target_minutes
    target_minutes = int(request.args.get('value', 120))
    return "OK"

@app.route('/on')
def turn_on():
    global timer_running, start_time
    timer_running = True
    start_time = time.time()
    return "Started"

@app.route('/off') 
def turn_off():
    global timer_running
    timer_running = False
    return "Stopped"

@app.route('/reset')
def reset():
    global timer_running, start_time
    timer_running = False  
    start_time = 0
    return "Reset"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80)
```

### Router-Integration (OpenWrt)

```bash
#!/bin/sh
# /usr/bin/gaming-timer

ELAPSED_FILE="/tmp/gaming_elapsed"
TARGET_FILE="/tmp/gaming_target"
RUNNING_FILE="/tmp/gaming_running"

case "$1" in
    elapsed)
        [ -f "$ELAPSED_FILE" ] && cat "$ELAPSED_FILE" || echo "0"
        ;;
    target)
        [ -f "$TARGET_FILE" ] && cat "$TARGET_FILE" || echo "120"
        ;;
    settarget)
        echo "$2" > "$TARGET_FILE"
        ;;
    on)
        echo "1" > "$RUNNING_FILE"
        date +%s > "${ELAPSED_FILE}.start"
        # Gaming-Geräte entsperren
        iptables -D FORWARD -m mac --mac-source AA:BB:CC:DD:EE:FF -j DROP 2>/dev/null
        ;;
    off)
        rm -f "$RUNNING_FILE"
        # Gaming-Geräte sperren  
        iptables -I FORWARD -m mac --mac-source AA:BB:CC:DD:EE:FF -j DROP
        ;;
    reset)
        rm -f "$ELAPSED_FILE" "$RUNNING_FILE" "${ELAPSED_FILE}.start"
        ;;
esac
```

## Lizenz

MIT License - siehe [LICENSE](LICENSE) Datei für Details.

## Beitragen

1. Fork das Repository
2. Erstelle einen Feature-Branch (`git checkout -b feature/amazing-feature`)
3. Commit deine Änderungen (`git commit -m 'Add amazing feature'`)
4. Push zum Branch (`git push origin feature/amazing-feature`) 
5. Öffne eine Pull Request

## Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/yourusername/homebridge-zockzeit/issues)
- 💬 **Diskussionen**: [GitHub Discussions](https://github.com/yourusername/homebridge-zockzeit/discussions)
- 📧 **E-Mail**: your.email@example.com

## Changelog

### v1.1.0
- ✨ Verbesserte Fehlerbehandlung
- ✨ Reset-Funktionalität hinzugefügt
- ✨ Konfigurable Timeouts
- ✨ Vollständige Thermostat-Integration
- 🐛 Stabilität bei Netzwerkproblemen

### v1.0.0
- 🎉 Erste Veröffentlichung
- ⚡ HTTP-basierte Timer-Kontrolle
- 🏠 HomeKit Thermostat Integration