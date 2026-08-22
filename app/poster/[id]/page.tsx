import PosterClient from "./PosterClient";

export const dynamic = "force-dynamic";

export default function PosterPage({ params }: { params: { id: string } }) {
  return <PosterClient id={params.id} />;
}
