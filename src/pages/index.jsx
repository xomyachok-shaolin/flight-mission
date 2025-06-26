// pages/index.jsx
import dynamic from "next/dynamic";
import { PageContainer } from "@ant-design/pro-layout";

// грузим MapComponent только на клиенте — там же используется maplibre-gl
const MapComponent = dynamic(() => import("../components/MapComponent"), {
  ssr: false,
});

export default function Home() {

  return (
    <PageContainer header={{ title: "" }}>
      <MapComponent />
    </PageContainer>
  );
}
