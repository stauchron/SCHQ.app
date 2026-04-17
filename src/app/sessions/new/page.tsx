import { NewSessionForm } from "./NewSessionForm";

type SearchParams = Promise<{ serial?: string }> | { serial?: string };

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  return (
    <>
      <div className="mb-8">
        <div className="eyebrow mb-2">Nieuwe testsessie</div>
        <h1
          className="font-black tracking-tight text-black"
          style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", lineHeight: 1.2 }}
        >
          Horloge identificeren
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-body">
          Voer serienummer en SKU in. Bestaat het paspoort al, dan koppelen we
          deze sessie eraan. Anders maken we een nieuw paspoort aan.
        </p>
      </div>
      <NewSessionForm initialSerial={params?.serial ?? ""} />
    </>
  );
}
