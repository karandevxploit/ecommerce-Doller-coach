import React, { useRef } from "react";

const ProductVideo = ({ videoUrl }) => {
  const videoRef = useRef(null);

  if (!videoUrl) return null;

  const handleMouseEnter = () => {
    if (videoRef.current) videoRef.current.pause();
  };

  const handleMouseLeave = () => {
    if (videoRef.current) videoRef.current.play();
  };

  return (
    <div className="product-video" style={{
      width: "280px",
      borderRadius: "16px",
      overflow: "hidden",
      boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
      border: "1px solid #f1f5f9",
      background: "#000",
      marginTop: "1.5rem"
    }}>
      <video
        ref={videoRef}
        src={videoUrl}
        autoPlay
        muted
        loop
        playsInline
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          objectFit: "cover",
          cursor: "pointer"
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
};

export default ProductVideo;
