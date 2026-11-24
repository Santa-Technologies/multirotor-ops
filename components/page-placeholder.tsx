/** Heading and short note for a module that is not built yet. */
export function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="mt-4 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        Nothing here yet.
      </div>
    </section>
  );
}
