# AnimES — plugin de Kino

Anime en español, doblado o subtitulado, desde AnimeAV1, Henaojara, TioAnime y JKAnime.

El catálogo, los episodios y los enlaces los entrega el addon **AnimES** de
[Pigamer37](https://github.com/Pigamer37/animeflv-stremio-addon); este plugin los adapta al formato nativo de Kino.
No está afiliado con ninguno de los sitios.

## Instalar

En Kino: **Plugins ▸ Agregar un plugin ▸ Kino**, y pega la dirección de este repositorio.

## Notas

- JKAnime viene apagado por defecto: su servidor no devuelve episodios ni búsquedas por ahora (se enciende en Ajustes).
- Algunas películas no tienen video porque el servidor del addon no las extrae.
- El video se reproduce desde servidores de terceros (YourUpload, MP4Upload...): Kino pide tu aprobación al instalar.
- Para los títulos que AnimeAV1 también tiene, la primera copia es su servidor HLS propio (más rápido; ver abajo). El
  ajuste **Copia HLS de AnimeAV1** la apaga.

## Cómo se reproduce: la copia HLS

### Qué hace

El addon solo entrega copias de MP4Upload (nodos `a1`, `a3`, `a4`) y YourUpload. MP4Upload limita la velocidad por nodo,
y en un Fire Stick eso daba de 0.0 a 1 Mbit/s y minutos hasta el primer cuadro. La página de episodio de AnimeAV1 lista
además su propio servidor HLS (`player.zilla-networks.com`), que sí rinde.

Para cada episodio, `resolve` hace dos cosas en paralelo:

1. Pide al addon sus copias (un solo intento corto de 2.5 s cuando el sitio puede tener el HLS).
2. Lee `https://animeav1.com/media/<slug>/<n>` con `kino.fetch` y saca el id del HLS de cada idioma (SUB y DUB).

Con el id arma el stream **directo**, sin navegador oculto:

```
url:     https://player.zilla-networks.com/m3u8/<id>
headers: Sec-Fetch-Site: same-origin
```

El audio elegido manda: primero el HLS de ese audio, luego el MP4 de ese audio, luego el resto. Las copias del addon
quedan como alternativas en el menú **Servidor y calidad**.

### Por qué funciona así

- El playlist `/m3u8/<id>` responde a una petición normal (200, sin headers).
- Los segmentos (`/segs/<id>/000.html`, `init.html`) están detrás de una regla de Cloudflare que mira `Sec-Fetch-Site`:
  sin ese header dan 403; con `same-origin` dan 200. No dependen de `Referer`, `User-Agent`, cookies ni de la huella TLS
  (se probó cada uno por separado).
- `kino.browser.capture` no sirve para esto: el player solo funciona dentro de un iframe (si no, escribe "Content not
  found.") y Kino descarta todos los `sec-*` al devolver una captura. Por eso el plugin ya no usa `browser`.
- Los slugs coinciden entre fuentes: el mismo `<slug>` y número de episodio de Henaojara o TioAnime existen en AnimeAV1.
  Medido en las series en emisión: 14/14 en Henaojara y 11/12 en TioAnime. Si la página no existe, es un 404 y el
  episodio sigue con sus copias del addon.
- Si el addon no responde, el HLS se reproduce igual; si no hay HLS, se reintenta al addon con su tiempo completo.
- Si el slug de otra fuente no existe en AnimeAV1 (p. ej. `megami-sama` frente a `megamisama`), se busca el título por
  nombre en el catálogo de AnimeAV1 del addon y solo se acepta una coincidencia exacta de letras; el resultado
  (incluido "no hay") se recuerda 7 días.
- Antes de ofrecer el HLS como principal se hace una comprobación barata, compartida por todos los episodios: el
  playlist y 1 KB del primer segmento con el header. Si Cloudflare responde 403 o 401 la copia se apaga 3 minutos y se
  reporta (`hls_blocked`); si todo va bien se recuerda 10 minutos. Un fallo de red no apaga nada.

### Qué no hace que sea más rápido

- Ni el `Referer`, ni el `User-Agent`, ni cabeceras `Sec-Fetch-*`, ni `Range` abierto o acotado, ni el token generado
  desde la IP propia cambian la velocidad de MP4Upload: varía de 0.5 a 20 Mbit/s entre peticiones con las mismas
  cabeceras. El cuello está en el servidor, no en cómo se le pide.
- El buffer del reproductor tampoco: el Fire Stick baja el HLS en ráfagas de 12–21 Mbit/s y descansa cuando tiene el
  buffer lleno.

### Mediciones (Fire Stick 4K Max, Wi-Fi 2.4 GHz, dentro de Kino, 2026-10-12)

Tiempo hasta ver imagen = tiempo de `resolve` + primer cuadro. "Antes" es 1.2.4 (MP4Upload principal), "después" 1.2.8.

| Fuente | Antes | Después |
|---|---|---|
| AnimeAV1 | 2.4 + 9.0 = 11.4 s | 2.3 + 1.1 = 3.4 s |
| Henaojara | 0.7 + 39.8 = 40.5 s | 1.2 + 1.4 = 2.7 s |
| TioAnime | 0.6 + 10.8 = 11.4 s | 1.2 + 1.3 = 2.6 s |

Descarga cruda desde el mismo aparato con `curl` (TLS, mismas condiciones): MP4Upload de 0.0 a 1.2 Mbit/s con 3–10 s
hasta el primer byte; segmentos HLS de 10 a 17 Mbit/s. Desde un Mac: MP4Upload de 0.1 a 8.9, HLS de 18 a 33 Mbit/s.

Límites de esta medición: una corrida por fuente y ~1 minuto de reproducción, un solo título (Tensei Akujo no Kuro
Rekishi), JKAnime sin medir, y la velocidad del MP4Upload varía mucho de una petición a otra.

### Riesgos conocidos

- Depende de una regla de Cloudflare ajena: si cambia lo que mira (hoy `Sec-Fetch-Site`), el plugin lo detecta con la
  comprobación de salud y vuelve a ofrecer MP4Upload como principal (se ve como `hls_blocked` en el reporte). Es lo
  primero a revisar si "el HLS no carga".
- El plugin le manda a ese servidor el mismo header que enviaría el player embebido del propio sitio. Es una decisión
  del dueño del plugin; si los autores del sitio o del addon lo piden, se quita desde `hlsStream()` en `plugin.js`.
- Los títulos sin página equivalente en AnimeAV1 siguen con las copias del addon. Una muestra de 34 episodios
  (primero, medio y último) dio 22 con HLS; los 12 restantes eran el episodio 2 de series en emisión que AnimeAV1 aún no
  tiene, y un título cuyo slug difiere (resuelto por nombre). La numeración coincide donde existe la página.
- Los segmentos llegan como `text/html` aunque son fMP4; ExoPlayer los lee por el playlist (`#EXT-X-MAP`).

### Cómo repetir la medición

En el aparato (Fire Stick o similar) con depuración `adb`:

1. Instala el plugin desde su dirección y reproduce un episodio; deja que corra sin tocar el control.
2. Mide los bytes de `wlan0` en `/proc/net/dev` cada 0.2 s durante ~50 s (un salto de posición cancela la descarga en
   curso y falsea el resultado: no los encadenes).
3. Con `adb logcat` busca `KinoPlugin` (`resolve ok after … ms`, `resolve: N copies`) y `KinoPlay`
   (`first_frame`, `stall`, `no_first_frame`).
4. Para aislar el servidor de Kino, sube un `curl` estático (armv7) a `/data/local/tmp` y pide los segmentos con
   `-H "Sec-Fetch-Site: same-origin"` y `--resolve` (el `curl` estático no resuelve nombres).
