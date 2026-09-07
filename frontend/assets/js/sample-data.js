/* ---------------------------------------------------------------
   PLACEHOLDER CATALOGUE
   Stand-in content so the static site is fully browsable before the
   Render Web Service exists. Once /api/products and /api/gallery are
   live, the API response replaces this automatically - see main.js.
   Remove this file when the backend is the source of truth.
   --------------------------------------------------------------- */
window.SITE_SAMPLE = {
  products: [
    { slug:'merino-dk-natural', name:'Merino DK — Undyed', category:'wool',
      price:145, unit:'100g ball', weight:'DK / 8 ply', fibre:'100% merino wool',
      metreage:'225 m', colour:'Natural cream',
      blurb:'Soft, springy South African merino left undyed. A workhorse for jerseys and baby knits.', stock:'in-stock' },
    { slug:'merino-dk-heather', name:'Merino DK — Heather', category:'wool',
      price:165, unit:'100g ball', weight:'DK / 8 ply', fibre:'100% merino wool',
      metreage:'225 m', colour:'Heather grey',
      blurb:'The same merino base, kettle-dyed in small batches for a gently mottled grey.', stock:'in-stock' },
    { slug:'mohair-silk-lace', name:'Mohair Silk Lace', category:'wool',
      price:280, unit:'25g ball', weight:'Lace / 2 ply', fibre:'72% kid mohair, 28% silk',
      metreage:'420 m', colour:'Dusty rose',
      blurb:'A halo of kid mohair on a silk core. Knit alone for weightless shawls or held double.', stock:'low' },
    { slug:'chunky-roving', name:'Chunky Roving', category:'wool',
      price:210, unit:'200g skein', weight:'Super chunky', fibre:'100% wool',
      metreage:'80 m', colour:'Oatmeal',
      blurb:'Big, lofty and quick. A blanket in a weekend on 12 mm needles.', stock:'in-stock' },
    { slug:'cotton-4ply', name:'Organic Cotton 4 Ply', category:'wool',
      price:120, unit:'50g ball', weight:'4 ply / fingering', fibre:'100% organic cotton',
      metreage:'170 m', colour:'Sage',
      blurb:'Cool and crisp with good stitch definition. Summer tops, dishcloths, market bags.', stock:'in-stock' },
    { slug:'sock-yarn-speckle', name:'Sock Yarn — Speckle', category:'wool',
      price:250, unit:'100g skein', weight:'4 ply / fingering', fibre:'75% merino, 25% nylon',
      metreage:'400 m', colour:'Speckled berry',
      blurb:'Hard-wearing nylon blend, hand-speckled. Enough for one adult pair.', stock:'in-stock' },

    { slug:'bamboo-needle-set', name:'Bamboo Straight Needle Set', category:'equipment',
      price:480, unit:'set of 8 pairs', blurb:'Sizes 3 mm to 8 mm in a cotton roll. Warm in the hand and quiet to work with.', stock:'in-stock' },
    { slug:'interchangeable-circulars', name:'Interchangeable Circular Set', category:'equipment',
      price:1250, unit:'set', blurb:'Nine tip pairs and four cable lengths in a zip case. The last needle set you need to buy.', stock:'low' },
    { slug:'dpn-set-2mm', name:'Double-Pointed Needles 2.5 mm', category:'equipment',
      price:130, unit:'set of 5', blurb:'Stainless steel, 20 cm. The sock knitter’s standard.', stock:'in-stock' },
    { slug:'stitch-markers', name:'Brass Stitch Markers', category:'equipment',
      price:95, unit:'set of 12', blurb:'Snag-free rings in three sizes, in a small tin.', stock:'in-stock' },
    { slug:'row-counter', name:'Row Counter Ring', category:'equipment',
      price:180, unit:'each', blurb:'Adjustable brass ring that counts to 99 without leaving your hand.', stock:'in-stock' },
    { slug:'project-bag', name:'Waxed Canvas Project Bag', category:'equipment',
      price:390, unit:'each', blurb:'Water-resistant, flat-bottomed, with an inner notions pocket and a yarn guide grommet.', stock:'in-stock' },

    { slug:'fishermans-jersey', name:'Fisherman’s Cable Jersey', category:'finished',
      price:2850, unit:'each', blurb:'Hand-knitted in undyed merino, traditional cable and moss panels. Made to order in your size.', stock:'made-to-order' },
    { slug:'mohair-shawl', name:'Mohair Halo Shawl', category:'finished',
      price:1650, unit:'each', blurb:'A weightless triangular shawl in kid mohair and silk. Blocks out to 180 cm.', stock:'in-stock' },
    { slug:'baby-blanket', name:'Heirloom Baby Blanket', category:'finished',
      price:1450, unit:'each', blurb:'Soft merino in a basketweave stitch, 80 × 100 cm. Machine washable on wool cycle.', stock:'in-stock' },
    { slug:'wool-socks', name:'Hand-Knitted Wool Socks', category:'finished',
      price:520, unit:'pair', blurb:'Merino and nylon, reinforced heel and toe. Choose your size and colourway.', stock:'made-to-order' },
    { slug:'beanie-ribbed', name:'Ribbed Merino Beanie', category:'finished',
      price:420, unit:'each', blurb:'Double-layered brim, snug without being tight. One size.', stock:'in-stock' },
    { slug:'cushion-cover', name:'Cable Cushion Cover', category:'finished',
      price:680, unit:'each', blurb:'Chunky cabled front, buttoned back, fits a 45 cm inner.', stock:'in-stock' }
  ],

  gallery: [
    { title:'Aran jersey in undyed merino', note:'Commissioned piece, 2025' },
    { title:'Christening shawl', note:'Lace weight mohair silk' },
    { title:'Colourwork yoke cardigan', note:'Six-colour Fair Isle yoke' },
    { title:'Chunky throw', note:'Super chunky roving, 140 × 180 cm' },
    { title:'Matching hat and mitten set', note:'Made to order' },
    { title:'Textured cushion collection', note:'Cable, bobble and moss' },
    { title:'Wedding shawl', note:'Hand-spun silk blend' },
    { title:'Baby layette', note:'Cardigan, bonnet and booties' },
    { title:'Fair Isle vest', note:'Traditional Shetland palette' }
  ]
};
