import Link from "next/link";
import { buttonClass } from "./ui";

export function NoBallot() {
  return (
    <div className="mx-auto max-w-md px-4 py-32 text-center">
      <p className="text-sm font-medium">No ballot yet</p>
      <p className="mt-1 text-[13px] text-muted">Upload a sample ballot to get started.</p>
      <Link href="/" className={buttonClass("primary", "mt-6")}>
        Upload ballot
      </Link>
    </div>
  );
}
