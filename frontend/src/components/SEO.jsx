import { Helmet } from 'react-helmet-async';

export default function SEO({ title, description, keywords, ogImage, ogUrl }) {
  const siteTitle = title ? `${title} | DOLLER Coach` : 'DOLLER Coach - Premium eCommerce Store';
  const siteDesc = description || 'Shop the latest premium collections at DOLLER Coach. Fast, secure, and intuitive shopping experience.';
  
  return (
    <Helmet>
      <title>{siteTitle}</title>
      <meta name="description" content={siteDesc} />
      {keywords && <meta name="keywords" content={keywords} />}
      
      {/* Open Graph Tags for social sharing */}
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={siteDesc} />
      <meta property="og:type" content="website" />
      {ogImage && <meta property="og:image" content={ogImage} />}
      {ogUrl && <meta property="og:url" content={ogUrl} />}
      
      {/* Twitter specific tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={siteDesc} />
      {ogImage && <meta name="twitter:image" content={ogImage} />}
    </Helmet>
  );
}
