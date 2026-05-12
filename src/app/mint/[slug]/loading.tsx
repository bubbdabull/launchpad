import { Skeleton } from "@/components/ui/skeleton";

export default function MintLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-[320px] w-full" />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 sm:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="min-h-[360px] rounded-2xl" />
      </div>
    </div>
  );
}
