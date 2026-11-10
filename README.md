# Energy Map (concept demo)

A clickable preview of what the Energy System Model web app is meant to look
like when finished. It is a static site: three files plus one data file, no
build step, no API keys.

- Globe and street map: MapLibre GL JS 5.6 in globe projection, with the free
  OpenFreeMap "dark" base map (OpenMapTiles, OpenStreetMap data).
- Energy layers sit under the roads and labels, so zooming in shows real
  streets through the colour.
- The screening model (LCOE for 11 technologies, 8 weighted criteria, economic
  impact) runs in the browser, so sliders update the map at once.

Most numbers are placeholders. Only the UK solar and onshore wind capacity
factors and the DESNZ-calibrated cost ranges come from the Layer 1 work in
`C:\Users\omogb\Code\energy-map`. The page labels which is which.

## Files

| File | What it is |
|---|---|
| `index.html` | Page structure |
| `style.css` | Look and layout |
| `app.js` | Model, map layers, panel, charts |
| `data/countries-110m.json` | Country shapes (Natural Earth via world-atlas 2.0.2) |
| `serve.js` | Local preview server, not needed online |

## Run it locally

```
node serve.js
```

Then open http://localhost:8766. Opening `index.html` straight from disk does
not work, because browsers block the data file request from a `file://` page.

## Put it online with GitHub Pages

GitHub Pages is free for public repositories. Anyone with the link can see
the site and the code.

1. Create an empty public repository on github.com, for example
   `energy-map-demo`. Do not add a README there.
2. In this folder:

   ```
   git init
   git add .
   git commit -m "Energy Map concept demo"
   git branch -M main
   git remote add origin https://github.com/<your-username>/energy-map-demo.git
   git push -u origin main
   ```

3. On GitHub: Settings, Pages, Source "Deploy from a branch", branch `main`,
   folder `/ (root)`, Save.
4. After a minute or two the site is at
   `https://<your-username>.github.io/energy-map-demo/`.

## Known limits

- Country fills use simplified 1:110m shapes, so coastlines look rough when
  zoomed in. The fills fade out as you zoom so the real map takes over.
- Cells cover the UK and Nigeria only, at about 7 to 10 km (the real Layer 1
  grid is 1 km).
- Hourly dispatch, PyPSA mixes, job factors and all non-UK resource values
  are illustrative.
