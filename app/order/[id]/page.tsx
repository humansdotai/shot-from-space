import OrderClient from "./OrderClient";

export const dynamic = "force-dynamic";

export default function OrderPage({ params }: { params: { id: string } }) {
  return <OrderClient id={params.id} />;
}
