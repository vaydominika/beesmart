import Image from "next/image";

const DEFAULT_AVATAR_URL = "/images/ProfilePicture.png";

interface BeeAvatarProps {
  avatarUrl?: string | null;
  className?: string;
}

export function BeeAvatar({ avatarUrl, className }: BeeAvatarProps) {
  const src = avatarUrl ?? DEFAULT_AVATAR_URL;
  return (
    <div className={className ?? "relative"}>
      {/* White outer circle */}
      <div className="w-16 h-16 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center overflow-hidden">
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
