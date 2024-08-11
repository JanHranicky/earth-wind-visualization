# O projektu

Projekt vizualizuje data globálního numerického modelu GFS. Projekt vizualizuje následující proměnné: rychlost větru, teplotu, vertikální rychlost v Pa/s (VVEL), vertikální rychlost v cm/s (DZDT), geopotenciální výšku a hustotu vzduchu. Vizualizace umožňuje výběr z několika tlakových hladin: 1000, 850, 700, 500, 250, 70 a 50 hPa.
Lze zobrazit jak současný stav atmosféry, tak vývoj několik dní do minulosti a předpověď až na 16 dní dopředu. Více informací o modelu GFS lze najíst na odkazu:

https://www.emc.ncep.noaa.gov/emc/pages/numerical_forecast_systems/gfs.php

# Prerekvizity a spuštění 

## Java
V projektu je využita utilita grib2json, pro konverzi meteorologických dat do formátu json. Pro fungování této utility je vyžadováno nainstalovat Javu. Tu lze stáhnout a naistalovat z odkazu:

http://www.java.com

Instalaci Javy lze ověřit následujícím příkazem do příkazového řádku (ten lze spustit start -> příkazový řádek):

    java --version

Jestliže je Java nainstalována měl by výstup příkazu vypadat následovně:

    java 19.0.1 2022-10-18 \
    Java(TM) SE Runtime Environment (build 19.0.1+10-21) \
    Java HotSpot(TM) 64-Bit Server VM (build 19.0.1+10-21, mixed mode, sharing)
  
## Spuštění
Po instalaci Javy lze projekt spustit jednoduše pomocí příslušeného spustitelného souboru v kořenové složce projektu. Jsou k dispozici tři spustitelné soubory, v závislosti na opračním systému:

    earth-macos - macOS
    earth-win.exe - Windows
    earth-linux - Linux

Po spuštění se otevře okno s příkazovým řádkem, které zobrazuje komunikaci se serverem. Automaticky se taky otevře okno defaultního prohlížeče, ve kterém se zobrazí samotný výstup z aplikace. Při zavření okna s příkazovým řádkem se uzavře spojení se serverem a aplikace v prohlížeči tak přestane reagovat. 
