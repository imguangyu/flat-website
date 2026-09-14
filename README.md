# FLAT Project Page

Static project website for **FLAT: Resampling Image and Text into 1D Flexible-Length Aligned Transmodal Tokens for Retrieval and Generation**.

## Local preview

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

The site is self-contained apart from Google Fonts and can be deployed directly with GitHub Pages.

## Static demo

The interactive gallery is fully static: example outputs are precomputed and stored under `static-demo/data/`. The browser switches among examples and prefix lengths, expands complete interpolation paths, and renders text–text, image–text, and image–image arithmetic; no inference server is required.
