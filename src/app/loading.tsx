import { Skeleton } from "@/components/ui/skeleton";

export default function RootLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Skeleton className="h-20 w-20 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
      </div>
      <Skeleton className="h-14 w-full rounded-2xl" />
      <Skeleton className="aspect-[16/9] w-full rounded-2xl sm:aspect-[21/9]" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    </div>
  );
}
