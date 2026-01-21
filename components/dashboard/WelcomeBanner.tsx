import Image from "next/image";
import { Button } from "@/components/ui/button";
import { mockUser } from "@/lib/mockData";

export function WelcomeBanner() {
  return (
    <div className="bg-[#FADA6D] rounded-lg p-6 flex items-center justify-between">
      <div className="flex-1">
        <h2 className="text-[48px] font-bold text-[#262626] mb-2">
          WELCOME BACK, {mockUser.name.toUpperCase()}!
        </h2>
        <p className="text-[40px] text-[#262626] mb-4">
          THINGS JUST WEREN'T THE SAME WITHOUT YOUR BEE-AUTIFUL PRESENCE!
        </p>
        <Button className="bg-[#FADA6D] text-[40px] text-[#262626] hover:bg-[#FADA6D]/90 border-2 border-[#262626] uppercase font-semibold rounded-lg">
          LET'S DISCOVER!
        </Button>
      </div>
      <div className="ml-8">
        <Image
          src="/images/WelcomeBackBee.png"
          alt="Welcome Bee"
          width={200}
          height={200}
          className="h-auto"
        />
      </div>
    </div>
  );
}
