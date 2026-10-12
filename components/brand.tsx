import Image from "next/image";

type BrandProps = {
  compact?: boolean;
};

export function Brand({ compact = false }: BrandProps) {
  return (
    <div className={compact ? "brand brand-compact" : "brand"}>
      <Image
        className="brand-mark"
        src="/rc-wordmark-dark.png"
        alt="Robotics Center"
        width={1273}
        height={130}
      />
      <div className="brand-copy">
        <p className="brand-kicker">Your Robotics Center account</p>
      </div>
    </div>
  );
}
