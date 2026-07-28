# welcome image template

`wayfinder:grilling` · child of `../MAP.md` · unassigned

**Blocked by:** `001` · `002`

## Question

What is the HTML/CSS template that composites the cartoon with "Welcome XXX", the
role, and Oppr branding?

The standing decision is generate-the-cartoon, template-the-text. This ticket
designs that template, mirroring how `linkedin.css` works for carousels:

- Canvas size(s): LinkedIn single image is 1080x1080 or 1200x627 - which, or both.
- Layout: where the cartoon sits, where "Welcome {name}" and the role sit, the
  Oppr wordmark, background treatment.
- How the cartoon (from ticket 001) is placed - its background/shape/aspect
  determines this, which is why this is blocked by the recipe.
- Which documented blocks it reuses vs new ones that must graduate into a
  stylesheet first (the design-system composition rule).
- Whether it lives in `linkedin.css`, a new `welcome.css`, or `social-image.css`.

Blocked by: cartoon recipe (what the figure looks like) · output IA (where it fits).
