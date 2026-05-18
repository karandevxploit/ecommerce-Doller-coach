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
  availability = "InStock",
}) {
  const siteTitle = "Doller Coach";
  const defaultDescription =
    "Premium clothing designed for everyday comfort and style.";
  const defaultSiteUrl = "https://dollercoach.com";
  const fallbackImage = `${defaultSiteUrl}/og-default.jpg`;

  const siteUrl =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : defaultSiteUrl;

  const currentPath =
    typeof window !== "undefined" && window.location?.pathname
      ? `${window.location.pathname}${window.location.search || ""}`
      : "";

  const normalizeUrl = (value, fallback = siteUrl) => {
    if (!value) return fallback;

    try {
      return new URL(value, siteUrl).toString();
    } catch {
      return fallback;
    }
  };

  const cleanText = (value, fallback = "") => {
    if (value === null || value === undefined) return fallback;

    return String(value)
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const truncate = (value, maxLength) => {
    const text = cleanText(value);

    if (text.length <= maxLength) return text;

    return `${text.slice(0, maxLength - 1).trim()}…`;
  };

  const safeTitle = truncate(title || "", 70);
  const fullTitle = safeTitle
    ? `${safeTitle} | ${siteTitle}`
    : `${siteTitle} | Premium Clothing`;

  const metaDescription =
    truncate(description || defaultDescription, 160) || defaultDescription;

  const fullUrl = normalizeUrl(url || currentPath || siteUrl);
  const metaImage = normalizeUrl(image || fallbackImage, fallbackImage);

  const numericPrice = Number(price);
  const hasValidPrice = Number.isFinite(numericPrice) && numericPrice > 0;

  const safeAvailability = String(availability || "InStock").replace(
    /[^a-zA-Z]/g,
    ""
  );

  const structuredData =
    safeTitle && hasValidPrice
      ? {
        "@context": "https://schema.org/",
        "@type": "Product",
        name: safeTitle,
        image: [metaImage],
        description: metaDescription,
        brand: {
          "@type": "Brand",
          name: siteTitle,
        },
        offers: {
          "@type": "Offer",
          url: fullUrl,
          priceCurrency: currency || "INR",
          price: numericPrice.toFixed(2),
          availability: `https://schema.org/${safeAvailability || "InStock"}`,
          itemCondition: "https://schema.org/NewCondition",
        },
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
      <meta property="og:type" content={type || "website"} />
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
