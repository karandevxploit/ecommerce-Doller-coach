import { Helmet } from "react-helmet-async";

/**
 * SEO Component
 * Fully optimized for SSR, social sharing, and product schema
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
  const defaultDescription =
    "Premium clothing designed for everyday comfort and style.";

  const fullTitle = title
    ? `${title} | ${siteTitle}`
    : `${siteTitle} | Premium Clothing`;

  const metaDescription = description || defaultDescription;

  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://dollercoach.com";

  const fullUrl = url ? `${siteUrl}${url}` : siteUrl;

  const fallbackImage = "https://dollercoach.com/og-default.jpg";
  const metaImage = image || fallbackImage;

  /* ---------------- STRUCTURED DATA ---------------- */
  const structuredData =
    title && price
      ? {
        "@context": "https://schema.org/",
        "@type": "Product",
        name: title,
        image: [metaImage],
        description: metaDescription,
        brand: {
          "@type": "Brand",
          name: siteTitle
        },
        offers: {
          "@type": "Offer",
          url: fullUrl,
          priceCurrency: currency,
          price: String(price),
          availability: `https://schema.org/${availability}`,
          itemCondition: "https://schema.org/NewCondition"
        }
      }
      : null;

  return (
    <Helmet prioritizeSeoTags>

      {/* BASIC */}
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      <link rel="canonical" href={fullUrl} />

      {/* ROBOTS */}
      <meta name="robots" content="index, follow" />

      {/* OPEN GRAPH */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={metaImage} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:site_name" content={siteTitle} />

      {/* TWITTER */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={metaImage} />

      {/* STRUCTURED DATA */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
}