
// Same DNS fix as server.js/createAdmin.js - Node v24 on Windows has a known querySrv
// ECONNREFUSED bug when resolving MongoDB Atlas SRV records.
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../src/models/Category.model');
const Brand = require('../src/models/Brand.model');
const Product = require('../src/models/Product.model');

// Refuse to run against production without an explicit --force flag - this script DELETES
// existing categories/brands/products before reseeding, which must never happen accidentally
// against a live, populated catalog.
if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.error(
    'Refused: NODE_ENV=production and no --force flag. This script deletes existing ' +
      'categories/brands/products. Run "node scripts/seed.js --force" if you are absolutely sure.'
  );
  process.exit(1);
}

// Cloudinary isn't wired up here (no real files to upload for dummy launch data) - these are
// generated placeholder images from a free service, with a fake publicId. That's safe: if an
// admin later "deletes" one of these images, deleteFromCloudinary() will just get a harmless
// "not found" from Cloudinary and silently ignore it (already how that utility is written).
const placeholderImage = (label, bg, fg) => ({
  url: `https://placehold.co/600x800/${bg}/${fg}?text=${encodeURIComponent(label)}`,
  publicId: `seed/${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
});

const CATEGORIES = [
  { name: 'Kamiz Shalwar', description: 'Traditional two-piece kamiz and shalwar sets for everyday and casual wear.', displayOrder: 1 },
  { name: 'Unstitched Suits', description: '2-piece and 3-piece unstitched fabric sets, ready for custom tailoring.', displayOrder: 2 },
  { name: 'Pent Shirt', description: 'Modern pent-shirt sets combining Western cuts with local fabrics.', displayOrder: 3 },
  { name: 'Trousers', description: 'Standalone trousers in cigarette, palazzo, and straight-leg styles.', displayOrder: 4 },
  { name: 'Party & Formal Wear', description: 'Embellished and premium-fabric suits for weddings and formal occasions.', displayOrder: 5 },
];

// Fictional brand names - deliberately not matching any real registered clothing brand.
const BRANDS = ['Noor Fabrics', 'Sohni Dharti', 'Rangeen Threads', 'Lal Haveli'];

// Generates 4 variants per product (2 colors x 2 sizes), with a small size-based price upcharge
// and, if the product has a discount, a comparePrice that mathematically implies that exact %.
const buildVariants = (basePrice, colors, fabricStatus, discountPercentage) => {
  const variants = [];
  colors.forEach((color, idx) => {
    const sizesForThisColor = idx % 2 === 0 ? ['S', 'M'] : ['M', 'L'];
    sizesForThisColor.forEach((size) => {
      const price = basePrice + (size === 'L' || size === 'XL' ? 100 : 0);
      const comparePrice =
        discountPercentage > 0 ? Math.round(price / (1 - discountPercentage / 100) / 10) * 10 : null;
      variants.push({
        color,
        size,
        fabricStatus,
        price,
        comparePrice,
        stock: Math.floor(Math.random() * 15) + 5, // 5-20, randomized so stock levels look realistic
        images: [placeholderImage(color, 'e8d5c4', '6b4423')],
      });
    });
  });
  return variants;
};

// Blueprint uses category/brand NAMES - resolved to real ObjectIds after Category/Brand are created.
const PRODUCTS_BLUEPRINT = [
  // ---- Kamiz Shalwar ----
  {
    name: 'Floral Lawn Kamiz Shalwar',
    description: 'Lightweight lawn kamiz shalwar with an all-over floral print, perfect for warm-weather daily wear.',
    categoryName: 'Kamiz Shalwar', brandName: 'Noor Fabrics', fabricType: 'Lawn', pieceCount: 2,
    fabricStatus: 'unstitched', isCustomStitchingAvailable: false, discountPercentage: 0,
    colors: ['Peach', 'Sky Blue'], basePrice: 2200,
  },
  {
    name: 'Classic Cotton Kamiz Shalwar',
    description: 'Breathable pure cotton kamiz shalwar in solid tones, tailored for a relaxed everyday fit.',
    categoryName: 'Kamiz Shalwar', brandName: 'Sohni Dharti', fabricType: 'Cotton', pieceCount: 2,
    fabricStatus: 'stitched', isCustomStitchingAvailable: false, discountPercentage: 0,
    colors: ['White', 'Black'], basePrice: 2800,
  },
  {
    name: 'Khaddar Winter Kamiz Shalwar',
    description: 'Warm khaddar fabric kamiz shalwar designed for the winter season, in rich seasonal colors.',
    categoryName: 'Kamiz Shalwar', brandName: 'Rangeen Threads', fabricType: 'Khaddar', pieceCount: 2,
    fabricStatus: 'unstitched', isCustomStitchingAvailable: false, discountPercentage: 30,
    colors: ['Maroon', 'Mustard'], basePrice: 2100,
  },

  // ---- Unstitched Suits ----
  {
    name: 'Chiffon 3-Piece Unstitched Suit',
    description: 'Premium chiffon 3-piece suit (shirt, trouser, dupatta) with delicate embroidery, ready for custom stitching.',
    categoryName: 'Unstitched Suits', brandName: 'Lal Haveli', fabricType: 'Chiffon', pieceCount: 3,
    fabricStatus: 'unstitched', isCustomStitchingAvailable: true, discountPercentage: 0,
    colors: ['Emerald Green', 'Wine'], basePrice: 4200,
  },
  {
    name: 'Embroidered Lawn 3-Piece Suit',
    description: 'Hand-embroidered lawn 3-piece suit set, a season favorite now on discount.',
    categoryName: 'Unstitched Suits', brandName: 'Noor Fabrics', fabricType: 'Lawn', pieceCount: 3,
    fabricStatus: 'unstitched', isCustomStitchingAvailable: false, discountPercentage: 30,
    colors: ['Rose Pink', 'Turquoise'], basePrice: 3600,
  },
  {
    name: 'Silk 2-Piece Unstitched Suit',
    description: 'Luxurious pure silk 2-piece unstitched fabric set with a subtle sheen, ideal for semi-formal events.',
    categoryName: 'Unstitched Suits', brandName: 'Sohni Dharti', fabricType: 'Silk', pieceCount: 2,
    fabricStatus: 'unstitched', isCustomStitchingAvailable: false, discountPercentage: 0,
    colors: ['Royal Blue', 'Gold'], basePrice: 4800,
  },
  {
    name: 'Printed Cotton 3-Piece Suit',
    description: 'Everyday printed cotton 3-piece suit, custom stitching available for a made-to-measure fit.',
    categoryName: 'Unstitched Suits', brandName: 'Rangeen Threads', fabricType: 'Cotton', pieceCount: 3,
    fabricStatus: 'unstitched', isCustomStitchingAvailable: true, discountPercentage: 0,
    colors: ['Beige', 'Grey'], basePrice: 3200,
  },

  // ---- Pent Shirt ----
  {
    name: 'Georgette Pent Shirt Set',
    description: 'Flowy georgette pent-shirt set with a modern silhouette, stitched and ready to wear.',
    categoryName: 'Pent Shirt', brandName: 'Lal Haveli', fabricType: 'Georgette', pieceCount: 2,
    fabricStatus: 'stitched', isCustomStitchingAvailable: false, discountPercentage: 0,
    colors: ['Black', 'Navy'], basePrice: 3400,
  },
  {
    name: 'Linen Casual Pent Shirt',
    description: 'Breathable linen pent-shirt set for effortless day-to-day comfort.',
    categoryName: 'Pent Shirt', brandName: 'Noor Fabrics', fabricType: 'Linen', pieceCount: 2,
    fabricStatus: 'stitched', isCustomStitchingAvailable: false, discountPercentage: 0,
    colors: ['Olive', 'Sand'], basePrice: 3000,
  },
  {
    name: 'Office Wear Cotton Pent Shirt',
    description: 'Crisp cotton pent-shirt set tailored for a polished office look, currently discounted.',
    categoryName: 'Pent Shirt', brandName: 'Sohni Dharti', fabricType: 'Cotton', pieceCount: 2,
    fabricStatus: 'stitched', isCustomStitchingAvailable: false, discountPercentage: 30,
    colors: ['White', 'Charcoal'], basePrice: 2600,
  },

  // ---- Trousers ----
  {
    name: 'Cigarette Formal Trousers',
    description: 'Slim-fit cigarette trousers in stretch cotton, a wardrobe staple for formal pairing.',
    categoryName: 'Trousers', brandName: 'Rangeen Threads', fabricType: 'Cotton', pieceCount: 1,
    fabricStatus: 'stitched', isCustomStitchingAvailable: false, discountPercentage: 0,
    colors: ['Black', 'Beige'], basePrice: 1800,
  },
  {
    name: 'Palazzo Casual Trousers',
    description: 'Wide-leg lawn palazzo trousers, light and comfortable for everyday wear.',
    categoryName: 'Trousers', brandName: 'Lal Haveli', fabricType: 'Lawn', pieceCount: 1,
    fabricStatus: 'stitched', isCustomStitchingAvailable: false, discountPercentage: 0,
    colors: ['Mint Green', 'Coral'], basePrice: 1600,
  },
  {
    name: 'Khaddar Straight Trousers',
    description: 'Warm khaddar straight-leg trousers, built for the winter season.',
    categoryName: 'Trousers', brandName: 'Noor Fabrics', fabricType: 'Khaddar', pieceCount: 1,
    fabricStatus: 'stitched', isCustomStitchingAvailable: false, discountPercentage: 0,
    colors: ['Brown', 'Black'], basePrice: 1900,
  },

  // ---- Party & Formal Wear ----
  {
    name: 'Silk Party Wear 3-Piece',
    description: 'Opulent pure silk 3-piece party wear suit, available with custom stitching for the perfect fit.',
    categoryName: 'Party & Formal Wear', brandName: 'Sohni Dharti', fabricType: 'Silk', pieceCount: 3,
    fabricStatus: 'stitched', isCustomStitchingAvailable: true, discountPercentage: 0,
    colors: ['Burgundy', 'Champagne'], basePrice: 6200,
  },
  {
    name: 'Chiffon Formal Gown Suit',
    description: 'Elegant chiffon 3-piece formal suit with a gown-inspired silhouette, on sale this season.',
    categoryName: 'Party & Formal Wear', brandName: 'Rangeen Threads', fabricType: 'Chiffon', pieceCount: 3,
    fabricStatus: 'stitched', isCustomStitchingAvailable: false, discountPercentage: 30,
    colors: ['Dusty Rose', 'Steel Blue'], basePrice: 5400,
  },
  {
    name: 'Embellished Silk Formal Suit',
    description: 'Hand-embellished silk 3-piece unstitched suit for weddings, custom stitching available.',
    categoryName: 'Party & Formal Wear', brandName: 'Lal Haveli', fabricType: 'Silk', pieceCount: 3,
    fabricStatus: 'unstitched', isCustomStitchingAvailable: true, discountPercentage: 0,
    colors: ['Deep Red', 'Black'], basePrice: 5800,
  },
  {
    name: 'Georgette Evening Wear Set',
    description: 'Soft-draping georgette 2-piece evening wear set, finished and ready to wear.',
    categoryName: 'Party & Formal Wear', brandName: 'Noor Fabrics', fabricType: 'Georgette', pieceCount: 2,
    fabricStatus: 'stitched', isCustomStitchingAvailable: false, discountPercentage: 0,
    colors: ['Lavender', 'Ivory'], basePrice: 4600,
  },
  {
    name: 'Lawn Casual Kurti',
    description: 'Single-piece lawn kurti for relaxed, everyday styling.',
    categoryName: 'Party & Formal Wear', brandName: 'Sohni Dharti', fabricType: 'Lawn', pieceCount: 1,
    fabricStatus: 'stitched', isCustomStitchingAvailable: false, discountPercentage: 0,
    colors: ['Yellow', 'White'], basePrice: 1500,
  },
  {
    name: 'Cotton Winter Shawl Suit',
    description: 'Cotton 3-piece suit bundled with a matching shawl for cooler months, currently discounted.',
    categoryName: 'Party & Formal Wear', brandName: 'Rangeen Threads', fabricType: 'Cotton', pieceCount: 3,
    fabricStatus: 'unstitched', isCustomStitchingAvailable: false, discountPercentage: 30,
    colors: ['Camel', 'Grey'], basePrice: 3800,
  },
  {
    name: 'Chiffon Bridal Party Suit',
    description: 'Statement chiffon 3-piece suit for bridal party occasions, custom stitching available.',
    categoryName: 'Party & Formal Wear', brandName: 'Lal Haveli', fabricType: 'Chiffon', pieceCount: 3,
    fabricStatus: 'stitched', isCustomStitchingAvailable: true, discountPercentage: 0,
    colors: ['Gold', 'Maroon'], basePrice: 7200,
  },
];

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB for seeding.');

  console.log('Clearing existing Category, Brand, and Product collections...');
  await Promise.all([Category.deleteMany({}), Brand.deleteMany({}), Product.deleteMany({})]);

  console.log(`Creating ${CATEGORIES.length} categories...`);
  const createdCategories = await Category.create(
    CATEGORIES.map((c) => ({ ...c, image: placeholderImage(c.name, 'd8c4a8', '4a3428') }))
  );
  const categoryIdByName = Object.fromEntries(createdCategories.map((c) => [c.name, c._id]));

  console.log(`Creating ${BRANDS.length} brands...`);
  const createdBrands = await Brand.create(
    BRANDS.map((name) => ({ name, logo: placeholderImage(name, 'c9b8a3', '3d2b1f') }))
  );
  const brandIdByName = Object.fromEntries(createdBrands.map((b) => [b.name, b._id]));

  console.log(`Creating ${PRODUCTS_BLUEPRINT.length} products...`);
  const productDocs = PRODUCTS_BLUEPRINT.map((p) => ({
    name: p.name,
    description: p.description,
    category: categoryIdByName[p.categoryName],
    brand: brandIdByName[p.brandName],
    fabricType: p.fabricType,
    pieceCount: p.pieceCount,
    isCustomStitchingAvailable: p.isCustomStitchingAvailable,
    discountPercentage: p.discountPercentage,
    images: [placeholderImage(p.name, 'f0e4d4', '5c4030')],
    variants: buildVariants(p.basePrice, p.colors, p.fabricStatus, p.discountPercentage),
  }));

  // Using .create() (not insertMany) so each product's pre-save hooks actually run -
  // slug generation and per-variant SKU auto-generation both depend on that.
  const createdProducts = await Product.create(productDocs);

  console.log('\n=== SEED COMPLETE ===');
  console.log(`Categories: ${createdCategories.length}`);
  console.log(`Brands: ${createdBrands.length}`);
  console.log(`Products: ${createdProducts.length}`);
  console.log(`  - with 30% discount: ${createdProducts.filter((p) => p.discountPercentage === 30).length}`);
  console.log(`  - with custom stitching: ${createdProducts.filter((p) => p.isCustomStitchingAvailable).length}`);
  console.log(`  - total variants: ${createdProducts.reduce((sum, p) => sum + p.variants.length, 0)}`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});