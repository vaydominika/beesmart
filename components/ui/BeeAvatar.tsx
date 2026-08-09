import Image from "next/image";

const DEFAULT_AVATAR_URL = "/images/ProfilePicture.png";

interface BeeAvatarProps {
  avatarUrl?: string | null;
  className?: string;
  borderClassName?: string;
}

export function BeeAvatar({ avatarUrl, className, borderClassName = "border-(--theme-sidebar)" }: BeeAvatarProps) {
  const src = avatarUrl ?? DEFAULT_AVATAR_URL;
  return (
    <div className={className ?? "relative"}>
      {/* White outer circle */}
      <div className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 bg-white ${borderClassName}`}>
        <Image
          src={src}
          alt="Profile"
          width={64}
          height={64}
          className="w-full h-full object-contain object-center"
        />
      </div>
    </div>
  );
}
