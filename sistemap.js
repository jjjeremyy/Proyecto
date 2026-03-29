import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const supabase = createClient(URL, KEY);
const BASE_URL = 'https://tusitio.com';

async function generarSitemap() {
  const { data } = await supabase
    .from('articulos')
    .select('slug, fecha_publicacion, categorias(slug)')
    .eq('estado', true)
    .order('fecha_publicacion', { ascending: false });

  const urls = [
    `<url><loc>${BASE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${BASE_URL}/Categorias/categorias.html</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
    ...data.map(art => `
      <url>
        <loc>${BASE_URL}/Articulo/articulo.html?slug=${art.slug}</loc>
        <lastmod>${art.fecha_publicacion}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
      </url>`
    )
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  writeFileSync('sitemap.xml', xml);
  console.log(`Sitemap generado: ${data.length} artículos`);
}

generarSitemap();
```

### URLs limpias — `_redirects` para GitHub Pages / Netlify

GitHub Pages no soporta URLs sin `.html` nativamente. Si migras a **Netlify** (gratuito), añade este archivo en la raíz:
```
/articulo/:slug    /Articulo/articulo.html?slug=:slug    200
/categoria/:cat    /Categorias/categorias.html            200
/admin             /admin/admin.html                      200