export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-5 gap-y-8">
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <div className="skeleton aspect-[2/3] rounded-[4px]" />
          <div className="skeleton h-1 mt-3 rounded-full" />
          <div className="skeleton h-3.5 mt-2 rounded w-4/5" />
        </li>
      ))}
    </ul>
  );
}

export default function Loading() {
  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="skeleton h-8 w-48 rounded-lg mb-2" />
      <div className="skeleton h-4 w-64 rounded mb-8" />
      <GridSkeleton />
    </main>
  );
}

