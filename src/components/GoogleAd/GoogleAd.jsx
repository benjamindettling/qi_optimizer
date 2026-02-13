import React, { useEffect, useRef } from "react";
import "./GoogleAd.css";

/**
 * GoogleAd Component
 *
 * Displays a Google AdSense ad that is responsive to its container width
 * and respects a maximum height constraint.
 *
 * @param {string} adSlot - The AdSense ad slot ID (e.g., "1234567890")
 * @param {string} adClient - The AdSense publisher ID (default from env var)
 * @param {object} style - Additional inline styles for the container
 * @param {number} maxHeight - Maximum height for the ad in pixels (default: 250)
 * @param {string} className - Additional CSS classes for the container
 */
export function GoogleAd({
  adSlot,
  adClient = import.meta.env.VITE_ADSENSE_CLIENT || "ca-pub-XXXXXXXXXXXXXXXX",
  style = {},
  maxHeight = 250,
  className = "",
}) {
  const adRef = useRef(null);

  useEffect(() => {
    try {
      // Initialize adsbygoogle array if it doesn't exist
      window.adsbygoogle = window.adsbygoogle || [];

      // Push the ad to be loaded
      if (adRef.current) {
        window.adsbygoogle.push({});
      }
    } catch (error) {
      console.error("AdSense error:", error);
    }
  }, []);

  // Don't render if no ad slot provided
  if (!adSlot) {
    console.warn("GoogleAd: No adSlot provided");
    return null;
  }

  return (
    <div
      className={`google-ad-container ${className}`}
      style={{ maxHeight: `${maxHeight}px`, ...style }}
    >
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{
          display: "block",
          width: "100%",
          maxHeight: `${maxHeight}px`,
        }}
        data-ad-client={adClient}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
