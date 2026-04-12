import { Helmet } from "react-helmet-async";

/**
 * High-Wow Dynamic SEO & Social Metadata Engine
 * Standardized for Production Excellence
 */
export default function SEO({ 
  title, 
  description, 
  image, 
  url, 
  type = "website",
  price,
  currency = "INR",
  availability = "InStock"
}) {
  const siteTitle = "Doller Coach";
  const fullTitle = title ? `${title} | ${siteTitle}` : `${siteTitle} | Premium Aesthetic Apparel`;
  const siteDescription = "Premium aesthetic apparel engineered for precision and style. Explore our exclusive collections.";
  const metaDescription = description || siteDescription;
  
  const siteUrl = window.location.origin;
  const fullUrl = url ? `${siteUrl}${url}` : window.location.href;
  const siteImage = "https://dollercoach.com/og-default.jpg"; // Default fallback
  const metaImage = image || siteImage;

  // Google Structured Data (JSON-LD) for Products
  const structuredData = price ? {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": title,
    "image": [metaImage],
    "description": metaDescription,
    "brand": { "@type": "Brand", "name": "Doller Coach" },
    "offers": {
      "@type": "Offer",
      "url": fullUrl,
      "priceCurrency": currency,
      "price": price,
      "itemCondition": "https://schema.org/NewCondition",
      "availability": `https://schema.org/${availability}`
    }
  } : null;

  return (
    <Helmet>
      {/* 1. Basic Metadata */}
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      <link rel="canonical" href={fullUrl} />

      {/* 2. OpenGraph (Facebook / WhatsApp / LinkedIn) */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={metaImage} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:site_name" content={siteTitle} />

      {/* 3. Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={metaImage} />

      {/* 4. Google Structured Data (JSON-LD) */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
}
