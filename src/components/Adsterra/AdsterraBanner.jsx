import { useEffect, useRef } from "react";

export default function AdsterraBanner({ formatKey, width, height }) {
  const bannerRef = useRef(null);

  useEffect(() => {
    // 1. Ensure we only load the ad once per component mount
    if (!bannerRef.current || bannerRef.current.hasChildNodes()) return;

    // 2. Set the global options object required by Adsterra
    window.atOptions = {
      key: formatKey,
      format: "iframe",
      height: height,
      width: width,
      params: {},
    };

    // 3. Create the script element and inject it
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = `https://www.highperformanceformat.com/${formatKey}/invoke.js`;
    script.async = true;

    bannerRef.current.appendChild(script);
  }, [formatKey, width, height]);

  return (
    <div
      className="adsterra-banner-container"
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        margin: "10px 0",
        minHeight: `${height}px`, // Reserves space so the UI doesn't jump
      }}
    >
      <div ref={bannerRef}></div>
    </div>
  );
}
