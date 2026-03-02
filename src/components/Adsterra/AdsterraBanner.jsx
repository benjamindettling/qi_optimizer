export default function AdsterraBanner({ adFile, width, height }) {
  return (
    <div
      className="adsterra-banner-container"
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        margin: "10px 0",
        minHeight: `${height}px`, // Reserves space to stop UI jumping
      }}
    >
      <iframe
        src={`/ads/${adFile}`}
        width={width}
        height={height}
        frameBorder="0"
        scrolling="no"
        style={{ border: "none", overflow: "hidden", display: "block" }}
        title={`Ad-${adFile}`}
      />
    </div>
  );
}
