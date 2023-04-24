# O projektu

Projekt vizualizuje data ..

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