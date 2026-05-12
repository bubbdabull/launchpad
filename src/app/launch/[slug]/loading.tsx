import { Skeleton } from "@/components/ui/skeleton";

export default function LaunchLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-[280px] w-full sm:h-[340px]" />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-12">
        <Skeleton className="h-48 rounded-2xl lg:col-span-3" />
        <div className="space-y-4 lg:col-span-6">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl lg:col-span-3" />
      </div>
    </div>
  );
}
